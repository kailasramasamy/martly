import type { Messaging } from "firebase-admin/messaging";
import { BRAND_PRODUCT_KINDS } from "@martly/shared/constants";
import type { BrandCampaignInput } from "@martly/shared/schemas";
import type { AdProduct, BannerPlacement, BrandCampaign, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getMarketingConfig } from "../marketing/config.js";
import { formatISTDate } from "../notify/copy.js";
import { createAdOrder, fulfilAdOrder, refundAdOrder, type BillingSnapshot } from "../marketing/billing.js";

type Db = PrismaClient | Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1000;
// Placements whose slots are counted per category rather than across the network
const PER_CATEGORY: BannerPlacement[] = ["CATEGORY_TOP", "SPONSORED_PRODUCT"];
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

type Package = Pick<AdProduct, "kind" | "placement">;
type Booking = { brandId: string; categoryId?: string | null; startsAt: Date; endsAt: Date; excludeId?: string };

/** A package's slots: its banner placement, or for featured brands (no banner) the featured list, per category */
const slotKey = (p: Package) => p.placement ?? p.kind;

const overlapping = (slot: Omit<Booking, "brandId">): Prisma.BrandCampaignWhereInput => ({
  status: { in: [...HOLDING] }, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt },
  ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
});

/**
 * How many brand campaigns already overlap this window in the package's slot (per category for takeovers, sponsored
 * products and featured brands). When it's full, the earliest start from which a window of the same length fits: that's
 * always the moment a held campaign ends, as sliding a window back to the last such moment never adds an overlap.
 */
export async function availability(db: Db, slot: Omit<Booking, "brandId"> & { product: Package }) {
  const config = await getMarketingConfig(db);
  const { placement, kind } = slot.product;
  const cap = placement ? config.slotLimits[placement]?.BRAND ?? null : config.featuredBrandSlots;
  const held = await db.brandCampaign.findMany({
    where: {
      status: { in: [...HOLDING] }, endsAt: { gt: slot.startsAt },
      ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
      ...(placement ? { placement } : { product: { kind } }),
      ...(!placement || PER_CATEGORY.includes(placement) ? { categoryId: slot.categoryId } : {}),
    },
    select: { startsAt: true, endsAt: true },
  });
  const length = slot.endsAt.getTime() - slot.startsAt.getTime();
  const overlaps = (start: Date) => held.filter((h) => h.startsAt.getTime() < start.getTime() + length && h.endsAt > start).length;
  const booked = overlaps(slot.startsAt);
  const available = cap === null || booked < cap;
  const nextStartsAt = available ? null : held.map((h) => h.endsAt).sort((a, b) => a.getTime() - b.getTime()).find((end) => overlaps(end) < cap!) ?? null;
  return { cap, booked, available, nextStartsAt };
}

/** Claims the package's slot for the booking inside its transaction; a brand is featured once at a time in a category */
async function holdSlot(tx: Prisma.TransactionClient, product: Package, booking: Booking) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`brand-slots:${slotKey(product)}`}))`;
  const slot = await availability(tx, { product, ...booking });
  const full = product.placement ? "That placement is fully booked" : "Every featured brand slot in that category is taken";
  const next = slot.nextStartsAt ? `; the next opening starts ${formatISTDate(slot.nextStartsAt)}` : "; pick other dates";
  if (!slot.available) throw new CampaignError(`${full} for these dates${next}`, 409);
  if (product.placement) return;
  const clash = await tx.brandCampaign.count({
    where: { ...overlapping(booking), brandId: booking.brandId, categoryId: booking.categoryId, product: { kind: product.kind } },
  });
  if (clash) throw new CampaignError("This brand is already featured in that category for some of these dates", 409);
}

async function brandProduct(db: Db, productId: string) {
  const product = await db.adProduct.findUnique({ where: { id: productId } });
  if (!product || !product.isActive || !(BRAND_PRODUCT_KINDS as readonly string[]).includes(product.kind) || (!product.placement && product.kind !== "BRAND_FEATURE")) {
    throw new CampaignError("Choose a brand package that's on sale");
  }
  return product;
}

function checkInput(product: AdProduct, input: BrandCampaignInput) {
  if (product.kind === "BRAND_TAKEOVER" && !input.categoryId) throw new CampaignError("A category takeover needs a category");
  if (product.kind === "BRAND_FEATURE" && !input.categoryId) throw new CampaignError("Pick the category to feature the brand in");
  if (product.kind === "BRAND_PROMOTION" && (!input.discountType || !input.discountValue)) throw new CampaignError("A brand promotion needs a discount");
  if (input.startsAt.getTime() < Date.now() - DAY_MS) throw new CampaignError("Pick a start date from today on");
  // A sponsored product's photo is its creative, and a featured brand has none
  const needsArt = product.placement && product.kind !== "BRAND_SPONSORED_PRODUCT";
  if (needsArt && !input.imageUrl && !input.brief) throw new CampaignError("Upload an image or describe what the AI should make");
}

/**
 * A sponsored product is one of the brand's own products: it runs in that product's category, opens the product, and its
 * photo is the creative, so there's nothing to design or review beyond the product itself.
 */
async function sponsoredTarget(db: Db, product: AdProduct, input: BrandCampaignInput): Promise<BrandCampaignInput> {
  if (product.kind !== "BRAND_SPONSORED_PRODUCT") return input;
  const item = input.actionTarget
    ? await db.product.findFirst({
        where: { id: input.actionTarget, brandId: input.brandId, isActive: true },
        select: { imageUrl: true, subcategory: { select: { categoryId: true } } },
      })
    : null;
  if (!item?.subcategory) throw new CampaignError("Pick one of the brand's own products to sponsor");
  return { ...input, actionType: "PRODUCT", categoryId: item.subcategory.categoryId, imageUrl: input.imageUrl ?? item.imageUrl };
}

/** A brand is featured in a category it sells in; otherwise the feature would lift nothing */
async function checkFeatureCategory(db: Db, product: AdProduct, input: BrandCampaignInput) {
  if (product.kind !== "BRAND_FEATURE" || !input.categoryId) return;
  const sells = await db.product.count({ where: { brandId: input.brandId, isActive: true, subcategory: { categoryId: input.categoryId } } });
  if (!sells) throw new CampaignError("The brand has no products in that category");
}

/** Books a campaign for a brand; it holds its slot while awaiting payment */
export async function createCampaign(prisma: PrismaClient, booked: BrandCampaignInput, createdById: string) {
  const product = await brandProduct(prisma, booked.productId);
  const input = await sponsoredTarget(prisma, product, booked);
  checkInput(product, input);
  await checkFeatureCategory(prisma, product, input);
  const window = windowFor(product, input.quantity, input.startsAt);
  return prisma.$transaction(async (tx) => {
    await holdSlot(tx, product, { brandId: input.brandId, categoryId: input.categoryId, ...window });
    return tx.brandCampaign.create({
      data: {
        ...input, ...window, placement: product.placement, status: "PENDING_PAYMENT", createdById,
        actionTarget: input.actionTarget ?? (input.actionType === "BRAND" ? input.brandId : null),
        discountType: product.kind === "BRAND_PROMOTION" ? input.discountType : null,
        discountValue: product.kind === "BRAND_PROMOTION" ? input.discountValue : null,
      },
    });
  });
}

/** Paid campaigns not yet live: their package, brand and length are bought, so only dates, reach and (before approval) the creative change */
const PAID_UPCOMING = ["IN_REVIEW", "SCHEDULED"];

/** Moves a paid campaign to new dates of the same length and changes where it runs; before approval the creative can change too */
async function reschedule(prisma: PrismaClient, campaign: BrandCampaign, input: BrandCampaignInput) {
  if (input.startsAt.getTime() < Date.now() - DAY_MS) throw new CampaignError("Pick a start date from today on");
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { id: campaign.productId } });
  const window = windowFor(product, campaign.quantity, input.startsAt);
  // A sponsored product keeps its product: changing it would move the campaign to another category's slot
  const target = campaign.placement === "SPONSORED_PRODUCT" ? {} : { actionType: input.actionType, actionTarget: input.actionTarget };
  const creative = campaign.status === "IN_REVIEW"
    ? { title: input.title, subtitle: input.subtitle, imageUrl: input.imageUrl, brief: input.brief, ...target }
    : {};
  return prisma.$transaction(async (tx) => {
    await holdSlot(tx, product, { brandId: campaign.brandId, categoryId: campaign.categoryId, ...window, excludeId: campaign.id });
    return tx.brandCampaign.update({
      where: { id: campaign.id },
      data: { ...creative, ...window, targetStoreIds: input.targetStoreIds, targetStates: input.targetStates, targetDistricts: input.targetDistricts },
    });
  });
}

/** Changes a campaign that isn't live yet: everything before it's paid, dates and reach after */
export async function updateCampaign(prisma: PrismaClient, campaign: BrandCampaign, edited: BrandCampaignInput) {
  if (PAID_UPCOMING.includes(campaign.status)) return reschedule(prisma, campaign, edited);
  if (!["DRAFT", "PENDING_PAYMENT"].includes(campaign.status)) throw new CampaignError("A running or finished campaign can't be changed", 409);
  const product = await brandProduct(prisma, edited.productId);
  const input = await sponsoredTarget(prisma, product, edited);
  checkInput(product, input);
  await checkFeatureCategory(prisma, product, input);
  const window = windowFor(product, input.quantity, input.startsAt);
  return prisma.$transaction(async (tx) => {
    await holdSlot(tx, product, { brandId: campaign.brandId, categoryId: input.categoryId, ...window, excludeId: campaign.id });
    return tx.brandCampaign.update({
      where: { id: campaign.id },
      data: { ...input, ...window, brandId: campaign.brandId, placement: product.placement, discountType: input.discountType ?? null, discountValue: input.discountValue ?? null },
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
  if (approve && campaign.placement && !campaign.imageUrl) throw new CampaignError("Add or generate the banner image before approving");
  if (!approve && campaign.adOrderId) await refundAdOrder(prisma, campaign.adOrderId);
  return prisma.brandCampaign.update({ where: { id: campaign.id }, data: { status: approve ? "SCHEDULED" : "REJECTED", reviewNote: note ?? null } });
}

/** Withdraws a campaign that hasn't started, refunding anything paid */
export async function cancelCampaign(prisma: PrismaClient, campaign: BrandCampaign) {
  if (!["DRAFT", "PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED"].includes(campaign.status)) throw new CampaignError("A running or finished campaign can't be cancelled", 409);
  if (campaign.adOrderId) await refundAdOrder(prisma, campaign.adOrderId);
  return prisma.brandCampaign.update({ where: { id: campaign.id }, data: { status: "CANCELLED" } });
}
