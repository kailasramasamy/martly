import type { PrismaClient } from "../../generated/prisma/client.js";
import { storeBanners } from "./marketing/banner-feed.js";

export interface SponsoredAd {
  bannerId: string;
  productId: string;
  categoryId: string;
}

type Row = { productId: string; product?: { subcategory?: { categoryId?: string | null } | null } | null };

/**
 * Sponsored products live at a store: through the banner feed (so the org's brand-ads switch, blocked brands and
 * slot limits apply), and only those the store has in stock.
 */
export async function liveSponsored(prisma: PrismaClient, store: { id: string; organizationId: string }): Promise<SponsoredAd[]> {
  const banners = await storeBanners(prisma, store, ["SPONSORED_PRODUCT"]);
  const ads = banners.filter((b) => b.actionType === "PRODUCT" && b.actionTarget && b.categoryId);
  if (ads.length === 0) return [];
  const stocked = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true, stock: { gt: 0 }, productId: { in: ads.map((a) => a.actionTarget!) } },
    distinct: ["productId"], select: { productId: true },
  });
  const inStock = new Set(stocked.map((s) => s.productId));
  return ads.filter((a) => inStock.has(a.actionTarget!)).map((a) => ({ bannerId: a.id, productId: a.actionTarget!, categoryId: a.categoryId! }));
}

/** The category most of a row's products sit in, which decides whose ad it carries */
export function dominantCategory(rows: Row[]) {
  const counts = new Map<string, number>();
  for (const row of new Map(rows.map((r) => [r.productId, r])).values()) {
    const id = row.product?.subcategory?.categoryId;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** The first ad for one of these categories that the page hasn't shown yet */
export function pickAd(ads: SponsoredAd[], categoryIds: Set<string>, shown: Set<string>) {
  return ads.find((a) => categoryIds.has(a.categoryId) && !shown.has(a.bannerId)) ?? null;
}

/**
 * Puts the ad's product second: after the first product's sizes, marked sponsored, and out of wherever else it sat in
 * the list so it never shows twice.
 */
export function injectAd<T extends Row>(rows: T[], adRows: T[], ad: SponsoredAd): (T & { sponsored?: { bannerId: string } })[] {
  const rest = rows.filter((r) => r.productId !== ad.productId);
  if (rest.length === 0) return rows;
  const firstId = rest[0].productId;
  const at = rest.findIndex((r) => r.productId !== firstId);
  const marked = adRows.map((r) => ({ ...r, sponsored: { bannerId: ad.bannerId } }));
  const index = at === -1 ? rest.length : at;
  return [...rest.slice(0, index), ...marked, ...rest.slice(index)];
}

/** The ad for a category listing: one whose category lies under the node being browsed (department, category or aisle) */
export async function listingAd(prisma: PrismaClient, store: { id: string; organizationId: string }, subcategoryIds: string[]) {
  const ads = await liveSponsored(prisma, store);
  if (ads.length === 0) return null;
  const categories = await prisma.subcategory.findMany({ where: { id: { in: subcategoryIds } }, distinct: ["categoryId"], select: { categoryId: true } });
  return pickAd(ads, new Set(categories.map((c) => c.categoryId)), new Set());
}
