import type { BannerPlacement, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getMarketingConfig } from "./config.js";

const FEED_SELECT = {
  id: true, title: true, subtitle: true, imageUrl: true, imageUrls: true, textInImage: true, placement: true,
  actionType: true, actionTarget: true, sponsorType: true, brandId: true, organizationId: true, viewCap: true, viewsServed: true,
  sortOrder: true, createdAt: true, categoryId: true,
} satisfies Prisma.BannerSelect;

type FeedRow = Prisma.BannerGetPayload<{ select: typeof FEED_SELECT }>;

/** Network brand banners only run in stores that list the brand, so every view can turn into a sale */
async function stockedBrands(prisma: PrismaClient, storeId: string, brandIds: string[]) {
  if (!brandIds.length) return new Set<string>();
  const rows = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, product: { brandId: { in: brandIds } } },
    distinct: ["productId"], select: { product: { select: { brandId: true } } },
  });
  return new Set(rows.map((r) => r.product.brandId).filter((id): id is string => !!id));
}

// Placements sold per category, whose caps count per category as booking does
const PER_CATEGORY = new Set<string>(["CATEGORY_TOP", "SPONSORED_PRODUCT"]);

/** Applies the per-placement, per-sponsor caps from the pricing settings, keeping the feed's order */
function capSlots(rows: FeedRow[], limits: Partial<Record<string, Partial<Record<string, number>>>>) {
  const seen = new Map<string, number>();
  return rows.filter((b) => {
    const cap = limits[b.placement]?.[b.sponsorType];
    if (cap === undefined) return true;
    const key = `${b.placement}:${b.sponsorType}${PER_CATEGORY.has(b.placement) ? `:${b.categoryId}` : ""}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n <= cap;
  });
}

/**
 * Live banners a store's shoppers see: the store's and its organisation's own (brand promotions it joined included),
 * Martly's, and network brand campaigns the owner allows for brands the store stocks.
 */
export async function storeBanners(
  prisma: PrismaClient,
  store: { id: string; organizationId: string },
  placements: BannerPlacement[],
  extra: Prisma.BannerWhereInput = {},
) {
  const now = new Date();
  const [org, config] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: store.organizationId }, select: { allowBrandAds: true, brandBlocks: { select: { brandId: true } } } }),
    getMarketingConfig(prisma),
  ]);
  const blocked = org.brandBlocks.map((b) => b.brandId);
  const networkBrand: Prisma.BannerWhereInput = {
    sponsorType: "BRAND", organizationId: null, storeId: null,
    OR: [{ targetStoreIds: { isEmpty: true } }, { targetStoreIds: { has: store.id } }],
  };
  // A block (or switching brand ads off) also hides brand promotions the organisation had already joined
  const hiddenBrands: Prisma.BannerWhereInput = org.allowBrandAds
    ? { NOT: { sponsorType: "BRAND", brandId: { in: blocked } } }
    : { NOT: { sponsorType: "BRAND" } };
  const rows = await prisma.banner.findMany({
    where: {
      isActive: true, placement: { in: placements },
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }, hiddenBrands, extra],
      OR: [
        { storeId: store.id },
        { storeId: null, organizationId: store.organizationId },
        { storeId: null, organizationId: null, sponsorType: "PLATFORM" },
        ...(org.allowBrandAds ? [networkBrand] : []),
      ],
    },
    // Newest first among equals, so a just-launched promo leads the carousel
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: FEED_SELECT,
  });
  const network = rows.filter((b) => b.sponsorType === "BRAND" && !b.organizationId);
  const stocked = await stockedBrands(prisma, store.id, [...new Set(network.map((b) => b.brandId!))]);
  const eligible = rows.filter((b) =>
    (b.viewCap === null || b.viewsServed < b.viewCap) && (b.sponsorType !== "BRAND" || b.organizationId || stocked.has(b.brandId!)));
  return capSlots(eligible, config.slotLimits).map((b) => ({
    id: b.id, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, imageUrls: b.imageUrls, textInImage: b.textInImage,
    placement: b.placement, actionType: b.actionType, actionTarget: b.actionTarget, sponsorType: b.sponsorType, brandId: b.brandId,
    categoryId: b.categoryId,
  }));
}
