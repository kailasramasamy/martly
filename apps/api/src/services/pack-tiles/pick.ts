import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { brandPopularitySql } from "../brand-popularity.js";
import { isFlat } from "./layout.js";

export interface Pack { productId: string; url: string; aspect: number }
interface Candidate extends Pack { categoryId: string; brandId: string | null }

const inStockAt = (storeId: string) => Prisma.sql`EXISTS (SELECT 1 FROM store_products sp
  WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0)`;

// The category's chosen packs the store stocks, in the category's order (they may sit in another category's aisle)
function chosenPacks(prisma: PrismaClient, storeId: string, categoryIds: string[]) {
  return prisma.$queryRaw<Candidate[]>`
    SELECT c.id AS "categoryId", p.id AS "productId", p.brand_id AS "brandId",
      p.pack_cutout_url AS url, p.pack_cutout_aspect AS aspect
    FROM categories c JOIN products p ON p.id = ANY(c.pack_product_ids)
    WHERE c.id = ANY(${categoryIds}::text[]) AND p.is_active AND p.pack_cutout_url IS NOT NULL AND ${inStockAt(storeId)}
    ORDER BY c.id, array_position(c.pack_product_ids, p.id)`;
}

// The store's other cut-out packs in each category, one per brand, brands best known in its region first
function popularPacks(prisma: PrismaClient, storeId: string, region: string | null, categoryIds: string[]) {
  return prisma.$queryRaw<Candidate[]>`
    SELECT "categoryId", "productId", "brandId", url, aspect FROM (
      SELECT DISTINCT ON (s.category_id, p.brand_id) s.category_id AS "categoryId", p.id AS "productId",
        p.brand_id AS "brandId", p.pack_cutout_url AS url, p.pack_cutout_aspect AS aspect, ${brandPopularitySql(region)} AS popularity
      FROM products p
      JOIN subcategories s ON s.id = p.subcategory_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE s.category_id = ANY(${categoryIds}::text[]) AND p.is_active AND p.pack_cutout_url IS NOT NULL AND ${inStockAt(storeId)}
      ORDER BY s.category_id, p.brand_id, p.id
    ) ranked
    ORDER BY popularity DESC, "productId"`;
}

/** The first pack, then the next one lying the same way (both flat or both upright), from another brand when it can */
function pairFrom(candidates: Candidate[]): [Candidate, Candidate] | null {
  const [back, ...rest] = candidates;
  if (!back) return null;
  const sameWay = rest.filter((c) => c.productId !== back.productId && isFlat(c.aspect) === isFlat(back.aspect));
  const front = sameWay.find((c) => c.brandId !== back.brandId) ?? sameWay[0];
  return front ? [back, front] : null;
}

const pack = ({ productId, url, aspect }: Pack): Pack => ({ productId, url, aspect });

/** Each category's tile pair at this store: its chosen packs first, then its best-known brands; none without two */
export async function pickPairs(prisma: PrismaClient, storeId: string, region: string | null, categoryIds: string[]) {
  const [chosen, popular] = await Promise.all([
    chosenPacks(prisma, storeId, categoryIds),
    popularPacks(prisma, storeId, region, categoryIds),
  ]);
  const pairs = new Map<string, [Pack, Pack]>();
  for (const categoryId of categoryIds) {
    const own = (c: Candidate) => c.categoryId === categoryId;
    const pair = pairFrom([...chosen.filter(own), ...popular.filter(own)]);
    if (pair) pairs.set(categoryId, [pack(pair[0]), pack(pair[1])]);
  }
  return pairs;
}
