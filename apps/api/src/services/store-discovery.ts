import type { PrismaClient } from "../../generated/prisma/client.js";
import { upcomingSlots, type OpenSlot } from "./delivery/slot-availability.js";
import { liveWindow } from "./store-feed.js";

// Slots shown per store card
const SLOTS_SHOWN = 6;
// Home hero banners repeated on the store's card, after its photo
const BANNERS_SHOWN = 4;

export interface StoreDiscoveryInfo {
  ratingAvg: number | null;
  ratingCount: number;
  expressEtaMinutes: number | null;
  operatingStart: string | null;
  operatingEnd: string | null;
  /** Items on offer right now and the biggest saving among them; null when nothing is discounted */
  deals: { count: number; maxPercent: number } | null;
  /** Scheduled slots still open for booking, soonest first */
  slots: OpenSlot[];
  /** Live home hero banners for this store: its own first, then its organisation's */
  banners: { id: string; imageUrl: string; actionType: string; actionTarget: string | null }[];
}

// A listing's live saving in percent: the store's own discount wins over the variant's, as at checkout
const DEAL_PERCENT = `
  CASE
    WHEN sp.discount_type IS NOT NULL AND sp.discount_value > 0
      AND (sp.discount_start IS NULL OR sp.discount_start <= now() AT TIME ZONE 'UTC')
      AND (sp.discount_end IS NULL OR sp.discount_end >= now() AT TIME ZONE 'UTC')
    THEN CASE sp.discount_type WHEN 'PERCENTAGE' THEN sp.discount_value ELSE sp.discount_value * 100 / NULLIF(sp.price, 0) END
    WHEN v.discount_type IS NOT NULL AND v.discount_value > 0
      AND (v.discount_start IS NULL OR v.discount_start <= now() AT TIME ZONE 'UTC')
      AND (v.discount_end IS NULL OR v.discount_end >= now() AT TIME ZONE 'UTC')
    THEN CASE v.discount_type WHEN 'PERCENTAGE' THEN v.discount_value ELSE v.discount_value * 100 / NULLIF(sp.price, 0) END
  END`;

/** Live deals per store, counting only listings a shopper can buy */
async function dealsByStore(prisma: PrismaClient, storeIds: string[]) {
  const rows = await prisma.$queryRawUnsafe<{ store_id: string; deals: number; max_percent: number }[]>(
    `SELECT store_id, count(*)::int AS deals, floor(max(pct))::int AS max_percent FROM (
       SELECT sp.store_id, ${DEAL_PERCENT} AS pct
       FROM store_products sp JOIN product_variants v ON v.id = sp.variant_id
       WHERE sp.store_id = ANY($1::text[]) AND sp.is_active AND sp.stock - sp.reserved_stock > 0
     ) d WHERE pct > 0 GROUP BY store_id`,
    storeIds,
  );
  return new Map(rows.map((r) => [r.store_id, { count: r.deals, maxPercent: Math.min(r.max_percent, 100) }]));
}

/** Live hero banners per store: store-specific ones lead, organisation-wide ones fill the rest */
async function bannersByStore(prisma: PrismaClient, storeIds: string[]) {
  const stores = await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, organizationId: true } });
  const banners = await prisma.banner.findMany({
    where: {
      isActive: true, placement: "HERO_CAROUSEL", AND: liveWindow(new Date()),
      OR: [{ storeId: { in: storeIds } }, { storeId: null, organizationId: { in: [...new Set(stores.map((s) => s.organizationId))] } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, imageUrl: true, actionType: true, actionTarget: true, storeId: true, organizationId: true },
  });
  return new Map(stores.map((s) => {
    const own = banners.filter((b) => b.storeId === s.id);
    const org = banners.filter((b) => !b.storeId && b.organizationId === s.organizationId);
    return [s.id, [...own, ...org].slice(0, BANNERS_SHOWN).map((b) => ({ id: b.id, imageUrl: b.imageUrl, actionType: b.actionType, actionTarget: b.actionTarget }))];
  }));
}

// Rating, express-delivery, next slot, banners and deals summary for each store, for customer-facing store lists.
export async function getStoreDiscoveryInfo(
  prisma: PrismaClient,
  storeIds: string[],
): Promise<Map<string, StoreDiscoveryInfo>> {
  if (storeIds.length === 0) return new Map();

  const [ratings, expressConfigs, deals, slots, banners] = await Promise.all([
    prisma.storeRating.groupBy({
      by: ["storeId"],
      where: { storeId: { in: storeIds } },
      _avg: { overallRating: true },
      _count: { _all: true },
    }),
    prisma.expressDeliveryConfig.findMany({
      where: { storeId: { in: storeIds }, isEnabled: true },
      select: { storeId: true, etaMinutes: true, operatingStart: true, operatingEnd: true },
    }),
    dealsByStore(prisma, storeIds),
    upcomingSlots(prisma, storeIds, SLOTS_SHOWN),
    bannersByStore(prisma, storeIds),
  ]);

  const ratingByStore = new Map(ratings.map((r) => [r.storeId, r]));
  const expressByStore = new Map(expressConfigs.map((e) => [e.storeId, e]));

  return new Map(
    storeIds.map((id) => {
      const rating = ratingByStore.get(id);
      const express = expressByStore.get(id);
      const avg = rating?._avg.overallRating;
      return [
        id,
        {
          ratingAvg: avg != null ? Math.round(avg * 10) / 10 : null,
          ratingCount: rating?._count._all ?? 0,
          expressEtaMinutes: express?.etaMinutes ?? null,
          operatingStart: express?.operatingStart ?? null,
          operatingEnd: express?.operatingEnd ?? null,
          deals: deals.get(id) ?? null,
          slots: slots.get(id) ?? [],
          banners: banners.get(id) ?? [],
        },
      ];
    }),
  );
}
