import type { PrismaClient } from "../../generated/prisma/client.js";
import { searchCollectionProducts } from "./search.js";
import { reviewSummaries, withAllSizes, withReviews } from "./store-feed.js";

/**
 * Ids of a collection's products this store has in stock, in the collection's order, optionally narrowed to aisles.
 * `matchIds` (a search's hits, best first) narrows it further and orders by relevance instead.
 */
export async function rankedCollectionProductIds(
  prisma: PrismaClient, collectionId: string, storeId: string, page: number, pageSize: number, subcategoryIds: string[] = [],
  matchIds?: string[],
) {
  const narrowed = subcategoryIds.length > 0;
  const searched = matchIds !== undefined;
  return prisma.$queryRaw<{ id: string; total: number }[]>`
    SELECT ci.product_id AS id, COUNT(*) OVER()::int AS total
    FROM collection_items ci
    JOIN products p ON p.id = ci.product_id AND p.is_active
    WHERE ci.collection_id = ${collectionId}
      AND (${!narrowed} OR p.subcategory_id = ANY(${subcategoryIds}::text[]))
      AND (${!searched} OR p.id = ANY(${matchIds ?? []}::text[]))
      AND EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0)
    ORDER BY array_position(${matchIds ?? []}::text[], ci.product_id), ci.sort_order, ci.product_id
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
}

/** A collection's products that this store has in stock, in the collection's order, or best match first for a search. */
export async function collectionProducts(
  prisma: PrismaClient, collectionId: string, storeId: string, page: number, pageSize: number, subcategoryIds: string[] = [], q?: string,
) {
  const matchIds = q ? (await searchCollectionProducts(prisma, storeId, collectionId, q)).productIds : undefined;
  const ranked = await rankedCollectionProductIds(prisma, collectionId, storeId, page, pageSize, subcategoryIds, matchIds);
  const products = await withAllSizes(prisma, storeId, ranked.map((r) => ({ productId: r.id })));
  const reviews = await reviewSummaries(prisma, ranked.map((r) => r.id));
  return { products: withReviews(products, reviews), total: ranked[0]?.total ?? 0 };
}
