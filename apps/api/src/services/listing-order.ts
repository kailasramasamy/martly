import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { brandPopularityLookup, storeRegion } from "./brand-popularity.js";
import { storeProductInclude } from "./store-product-view.js";

/**
 * Pages of a category listing in ranking order: each product's brand popularity where it sits (Martly's ranking for its
 * subcategory or category, else the brand's regional or national score), then newest. A category holds a few hundred
 * listings, so each set is read once per request, sorted in code and paged from there; the shape fits the listing
 * pagers (boostedListingPage, looseFirstPage)
 */
export async function rankedListingFind(prisma: PrismaClient, storeId: string) {
  const region = await storeRegion(prisma, storeId);
  const orders = new Map<string, Promise<string[]>>();
  const orderedIds = async (where: Prisma.StoreProductWhereInput) => {
    const rows = await prisma.storeProduct.findMany({
      where, select: { id: true, createdAt: true, product: { select: { brandId: true, subcategoryId: true } } },
    });
    const popularity = await brandPopularityLookup(prisma, region, rows.map((r) => r.product));
    const score = new Map(rows.map((r) => [r.id, popularity(r.product)]));
    return rows
      .sort((a, b) => score.get(b.id)! - score.get(a.id)! || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((r) => r.id);
  };
  return async (where: Prisma.StoreProductWhereInput, skip: number, take: number) => {
    const key = JSON.stringify(where);
    if (!orders.has(key)) orders.set(key, orderedIds(where));
    const ids = (await orders.get(key)!).slice(skip, skip + take);
    const rows = await prisma.storeProduct.findMany({ where: { id: { in: ids } }, include: storeProductInclude });
    return rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  };
}
