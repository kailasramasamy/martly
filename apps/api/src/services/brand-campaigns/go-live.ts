import type { Messaging } from "firebase-admin/messaging";
import type { FastifyBaseLogger } from "fastify";
import type { BrandCampaign, PrismaClient } from "../../../generated/prisma/client.js";
import { notifyCampaignScheduled, pushBrandCampaignLive } from "../notify/marketing-alerts.js";
import { endPromo, launchPromo, PromoStateError } from "../promo/lifecycle.js";
import { storesTargeted } from "./targeting.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const UNPAID_HOLD_MS = 2 * DAY_MS;
const MAX_PROMO_PRODUCTS = 20;

interface Deps {
  prisma: PrismaClient;
  fcm: Messaging | null;
  log: FastifyBaseLogger;
}

/** A network banner (brand banner, category takeover or prepaid views) served wherever the feed finds the brand stocked */
async function startBanner(prisma: PrismaClient, campaign: BrandCampaign) {
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { id: campaign.productId } });
  await prisma.banner.create({
    data: {
      sponsorType: "BRAND", brandId: campaign.brandId, brandCampaignId: campaign.id, title: campaign.title, subtitle: campaign.subtitle,
      imageUrl: campaign.imageUrl!, textInImage: true, placement: campaign.placement!, categoryId: campaign.categoryId,
      actionType: campaign.actionType, actionTarget: campaign.actionTarget,
      targetStoreIds: campaign.targetStoreIds, targetStates: campaign.targetStates, targetDistricts: campaign.targetDistricts,
      startsAt: campaign.startsAt, endsAt: campaign.endsAt, sortOrder: 1,
      viewCap: product.kind === "BRAND_CPM" ? campaign.quantity * (product.viewsPerUnit ?? 1000) : null,
    },
  });
}

/**
 * Organisations that take part in a brand promotion: an active store the campaign targets stocks the brand. Promos are
 * organisation-wide, so the price cut then runs in all of that organisation's stores.
 */
export function participatingOrgs(prisma: PrismaClient, campaign: BrandCampaign) {
  return prisma.organization.findMany({
    where: {
      stores: {
        some: {
          status: "ACTIVE", ...storesTargeted(campaign),
          storeProducts: { some: { isActive: true, product: { brandId: campaign.brandId } } },
        },
      },
    },
    select: { id: true },
  });
}

/** One promo per organisation with the brand's products and the campaign's discount and art, launched straight away */
async function startPromotion(deps: Deps, campaign: BrandCampaign, organizationId: string) {
  const { prisma } = deps;
  const listed = await prisma.storeProduct.findMany({
    where: { isActive: true, store: { organizationId, status: "ACTIVE" }, product: { brandId: campaign.brandId } },
    distinct: ["productId"], take: MAX_PROMO_PRODUCTS, select: { productId: true },
  });
  const copy = { en: { title: campaign.title, subtitle: campaign.subtitle ?? "" } };
  const promo = await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.create({
      data: {
        organizationId, slug: `brand-${campaign.id.slice(0, 8)}-${organizationId.slice(0, 8)}`, kind: "PROMO", source: "AGENT", isActive: false,
        title: campaign.title, subtitle: campaign.subtitle, imageUrl: campaign.imageUrl, textInImage: true,
        items: { create: listed.map(({ productId }, sortOrder) => ({ productId, sortOrder })) },
      },
    });
    return tx.promo.create({
      data: {
        organizationId, createdById: campaign.createdById, brief: `Brand promotion: ${campaign.title}`, status: "READY", notify: false,
        chargedFrom: "BRAND", brandCampaignId: campaign.id, collectionId: collection.id, copy,
        discountType: campaign.discountType, discountValue: campaign.discountValue,
        durationDays: Math.max(1, Math.ceil((campaign.endsAt.getTime() - Date.now()) / DAY_MS)),
      },
    });
  });
  await launchPromo(deps, promo.id);
  await prisma.banner.updateMany({ where: { promoId: promo.id }, data: { sponsorType: "BRAND", brandId: campaign.brandId, sortOrder: 1 } });
}

/** Takes a scheduled campaign live; the SCHEDULED → LIVE claim keeps two instances from starting it twice */
export async function startCampaign(deps: Deps, campaign: BrandCampaign) {
  const { count } = await deps.prisma.brandCampaign.updateMany({ where: { id: campaign.id, status: "SCHEDULED" }, data: { status: "LIVE" } });
  if (!count) return;
  // A featured brand only changes ranking, which reads live campaigns; there's no banner, offer or announcement
  if (!campaign.placement) return;
  const orgs = await participatingOrgs(deps.prisma, campaign);
  if (!campaign.discountType) await startBanner(deps.prisma, campaign);
  for (const { id } of orgs) {
    // One organisation's failure shouldn't keep the brand's offer out of every other store
    if (campaign.discountType) {
      await startPromotion(deps, campaign, id).catch((err: unknown) => deps.log.error(err, `Brand campaign ${campaign.id}: promo for org ${id} failed`));
    }
    await pushBrandCampaignLive(deps.fcm, deps.prisma, campaign, id).catch((err: unknown) => deps.log.error(err, `Brand campaign ${campaign.id}: push for org ${id} failed`));
  }
}

/**
 * An approved or rescheduled campaign whose start date has come goes live now instead of waiting for the scheduler;
 * otherwise owners of the stores it reaches hear when it starts
 */
export async function launchOrAnnounce(deps: Deps, campaign: BrandCampaign, rescheduled = false) {
  if (campaign.startsAt <= new Date()) return startCampaign(deps, campaign);
  const orgs = await participatingOrgs(deps.prisma, campaign);
  void notifyCampaignScheduled(deps.fcm, deps.prisma, campaign, orgs.map((o) => o.id), rescheduled)
    .catch((err: unknown) => deps.log.error(err, `Brand campaign ${campaign.id}: schedule alert failed`));
}

/** Ends a live campaign: its banner goes off and every store's promo restores its prices */
export async function endCampaign(prisma: PrismaClient, campaign: Pick<BrandCampaign, "id">) {
  const { count } = await prisma.brandCampaign.updateMany({ where: { id: campaign.id, status: "LIVE" }, data: { status: "ENDED" } });
  if (!count) return;
  await prisma.banner.updateMany({ where: { brandCampaignId: campaign.id }, data: { isActive: false } });
  const promos = await prisma.promo.findMany({ where: { brandCampaignId: campaign.id, status: "LIVE" }, select: { id: true } });
  for (const { id } of promos) {
    await endPromo(prisma, id, true).catch((err: unknown) => {
      if (!(err instanceof PromoStateError)) throw err;
    });
  }
}

/** Moves campaigns along their dates and lets unpaid bookings lapse so their slots free up */
export async function advanceCampaigns(deps: Deps) {
  const now = new Date();
  const due = await deps.prisma.brandCampaign.findMany({ where: { status: "SCHEDULED", startsAt: { lte: now } } });
  for (const campaign of due) await startCampaign(deps, campaign);
  const over = await deps.prisma.brandCampaign.findMany({ where: { status: "LIVE", endsAt: { lte: now } }, select: { id: true } });
  for (const campaign of over) await endCampaign(deps.prisma, campaign);
  await deps.prisma.brandCampaign.updateMany({
    where: { status: "PENDING_PAYMENT", updatedAt: { lt: new Date(now.getTime() - UNPAID_HOLD_MS) } },
    data: { status: "CANCELLED" },
  });
}
