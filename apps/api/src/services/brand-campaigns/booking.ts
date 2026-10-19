import type { Messaging } from "firebase-admin/messaging";
import type { BrandCampaignInput } from "@martly/shared/schemas";
import type { AdProduct, BannerPlacement, BrandCampaign, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getMarketingConfig } from "../marketing/config.js";
import { createAdOrder, fulfilAdOrder, refundAdOrder, type BillingSnapshot } from "../marketing/billing.js";

type Db = PrismaClient | Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1000;
const BRAND_KINDS = ["BRAND_BANNER", "BRAND_TAKEOVER", "BRAND_PROMOTION", "BRAND_CPM"] as const;
/** Campaigns that hold a slot: unpaid ones too (until they lapse), so a slot can't be sold twice */
const HOLDING = ["PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED", "LIVE"] as const;

export class CampaignError extends Error {
  name = "CampaignError";
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

/** Weekly packages run for as many weeks as bought; view packages run their fixed window until the views are delivered */
export function windowFor(product: AdProduct, quantity: number, startsAt: Date) {
  const days = product.kind === "BRAND_CPM" ? product.durationDays : product.durationDays * quantity;
  return { startsAt, endsAt: new Date(startsAt.getTime() + days * DAY_MS) };
}

/** How many brand campaigns already overlap this window in the placement (per category for takeovers) */
export async function availability(
  db: Db,
  slot: { placement: BannerPlacement; categoryId?: string | null; startsAt: Date; endsAt: Date; excludeId?: string },
) {
  const { slotLimits } = await getMarketingConfig(db);
  const cap = slotLimits[slot.placement]?.BRAND ?? null;
  const booked = await db.brandCampaign.count({
    where: {
      placement: slot.placement, status: { in: [...HOLDING] }, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt },
      ...(slot.placement === "CATEGORY_TOP" ? { categoryId: slot.categoryId } : {}),
      ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
    },
  });
  return { cap, booked, available: cap === null || booked < cap };
}

async function brandProduct(db: Db, productId: string) {
  const product = await db.adProduct.findUnique({ where: { id: productId } });
  if (!product || !product.isActive || !(BRAND_KINDS as readonly string[]).includes(product.kind) || !product.placement) {
    throw new CampaignError("Choose a brand package that's on sale");
  }
  return product;
}

function checkInput(product: AdProduct, input: BrandCampaignInput) {
  if (product.kind === "BRAND_TAKEOVER" && !input.categoryId) throw new CampaignError("A category takeover needs a category");
  if (product.kind === "BRAND_PROMOTION" && (!input.discountType || !input.discountValue)) throw new CampaignError("A brand promotion needs a discount");
  if (input.startsAt.getTime() < Date.now() - DAY_MS) throw new CampaignError("Pick a start date from today on");
}

/** Books a campaign for a brand; it holds its slot while awaiting payment */
export async function createCampaign(prisma: PrismaClient, input: BrandCampaignInput, createdById: string) {
  const product = await brandProduct(prisma, input.productId);
  checkInput(product, input);
  const window = windowFor(product, input.quantity, input.startsAt);
  const placement = product.placement!;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`brand-slots:${placement}`}))`;
    const slot = await availability(tx, { placement, categoryId: input.categoryId, ...window });
    if (!slot.available) throw new CampaignError("That placement is fully booked for these dates; pick other dates", 409);
    return tx.brandCampaign.create({
      data: {
        ...input, ...window, placement, status: "PENDING_PAYMENT", createdById,
        actionTarget: input.actionTarget ?? (input.actionType === "BRAND" ? input.brandId : null),
        discountType: product.kind === "BRAND_PROMOTION" ? input.discountType : null,
        discountValue: product.kind === "BRAND_PROMOTION" ? input.discountValue : null,
      },
    });
  });
}

/** Changes a campaign before it's paid; once paid only the creative and copy can change */
export async function updateCampaign(prisma: PrismaClient, campaign: BrandCampaign, input: BrandCampaignInput) {
  if (!["DRAFT", "PENDING_PAYMENT", "IN_REVIEW"].includes(campaign.status)) throw new CampaignError("This campaign can no longer be changed", 409);
  const creative = { title: input.title, subtitle: input.subtitle, imageUrl: input.imageUrl, brief: input.brief, actionType: input.actionType, actionTarget: input.actionTarget };
  if (campaign.status === "IN_REVIEW") return prisma.brandCampaign.update({ where: { id: campaign.id }, data: creative });
  const product = await brandProduct(prisma, input.productId);
  checkInput(product, input);
  const window = windowFor(product, input.quantity, input.startsAt);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`brand-slots:${product.placement}`}))`;
    const slot = await availability(tx, { placement: product.placement!, categoryId: input.categoryId, ...window, excludeId: campaign.id });
    if (!slot.available) throw new CampaignError("That placement is fully booked for these dates; pick other dates", 409);
    return tx.brandCampaign.update({
      where: { id: campaign.id },
      data: { ...input, ...window, brandId: campaign.brandId, placement: product.placement!, discountType: input.discountType ?? null, discountValue: input.discountValue ?? null },
    });
  });
}

/** Opens payment for a campaign (a fresh order each time; an earlier unpaid one is cancelled) */
export async function checkoutCampaign(prisma: PrismaClient, campaign: BrandCampaign, billing: BillingSnapshot, createdById: string, online = true) {
  if (campaign.status !== "PENDING_PAYMENT") throw new CampaignError("This campaign isn't waiting for payment", 409);
  if (campaign.adOrderId) await refundAdOrder(prisma, campaign.adOrderId);
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { id: campaign.productId } });
  const purchase = await createAdOrder(prisma, product, campaign.quantity, { brandId: campaign.brandId, billing, createdById }, online);
  await prisma.brandCampaign.update({ where: { id: campaign.id }, data: { adOrderId: purchase.order.id } });
  return purchase;
}

/** Records a bank transfer received by Martly; the campaign moves on to review */
export async function markPaidOffline(prisma: PrismaClient, campaign: BrandCampaign, billing: BillingSnapshot, reference: string, createdById: string, fcm: Messaging | null = null) {
  const { order } = await checkoutCampaign(prisma, campaign, billing, createdById, false);
  return fulfilAdOrder(prisma, order.id, { offlineReference: reference }, fcm);
}

/** Martly approves the creative (the campaign then starts on its date) or rejects it with a full refund */
export async function reviewCampaign(prisma: PrismaClient, campaign: BrandCampaign, approve: boolean, note?: string | null) {
  if (campaign.status !== "IN_REVIEW") throw new CampaignError("Only a paid campaign in review can be approved or rejected", 409);
  if (approve && !campaign.imageUrl) throw new CampaignError("Add or generate the banner image before approving");
  if (!approve && campaign.adOrderId) await refundAdOrder(prisma, campaign.adOrderId);
  return prisma.brandCampaign.update({ where: { id: campaign.id }, data: { status: approve ? "SCHEDULED" : "REJECTED", reviewNote: note ?? null } });
}

/** Withdraws a campaign that hasn't started, refunding anything paid */
export async function cancelCampaign(prisma: PrismaClient, campaign: BrandCampaign) {
  if (!["DRAFT", "PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED"].includes(campaign.status)) throw new CampaignError("A running or finished campaign can't be cancelled", 409);
  if (campaign.adOrderId) await refundAdOrder(prisma, campaign.adOrderId);
  return prisma.brandCampaign.update({ where: { id: campaign.id }, data: { status: "CANCELLED" } });
}
