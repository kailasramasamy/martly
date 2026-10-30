import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { brandPopularitySql } from "../brand-popularity.js";
import { isFlat } from "./layout.js";

export interface Pack { productId: string; url: string; aspect: number }
// ownerId is the category (or department) the pack is a candidate for
interface Candidate extends Pack { ownerId: string; brandId: string | null }

const inStockAt = (storeId: string) => Prisma.sql`EXISTS (SELECT 1 FROM store_products sp
  WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0)`;

// Each category's (or department's) chosen packs the store stocks, in its order (they may sit in another aisle)
function chosenPacks(prisma: PrismaClient, storeId: string, table: "categories" | "departments", ownerIds: string[]) {
  return prisma.$queryRaw<Candidate[]>`
    SELECT o.id AS "ownerId", p.id AS "productId", p.brand_id AS "brandId",
      p.pack_cutout_url AS url, p.pack_cutout_aspect AS aspect
    FROM ${Prisma.raw(table)} o JOIN products p ON p.id = ANY(o.pack_product_ids)
    WHERE o.id = ANY(${ownerIds}::text[]) AND p.is_active AND p.pack_cutout_url IS NOT NULL AND ${inStockAt(storeId)}
    ORDER BY o.id, array_position(o.pack_product_ids, p.id)`;
}

// The store's other cut-out packs in each category, one per brand, brands best known in its region first
function popularPacks(prisma: PrismaClient, storeId: string, region: string | null, categoryIds: string[]) {
  return prisma.$queryRaw<Candidate[]>`
    SELECT "ownerId", "productId", "brandId", url, aspect FROM (
      SELECT DISTINCT ON (s.category_id, p.brand_id) s.category_id AS "ownerId", p.id AS "productId",
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

/** Each category's tile pair at this store: its first two chosen packs it stocks, else matched from its chosen and best-known packs */
export async function pickPairs(prisma: PrismaClient, storeId: string, region: string | null, categoryIds: string[]) {
  const [chosen, popular] = await Promise.all([
    chosenPacks(prisma, storeId, "categories", categoryIds),
    popularPacks(prisma, storeId, region, categoryIds),
  ]);
  const pairs = new Map<string, [Pack, Pack]>();
  for (const categoryId of categoryIds) {
    const own = (c: Candidate) => c.ownerId === categoryId;
    const picked = chosen.filter(own);
    // Two chosen packs are shown as chosen, even one flat beside one upright; otherwise the pair is matched
    const pair = picked.length >= 2 ? [picked[0], picked[1]] as const : pairFrom([...picked, ...popular.filter(own)]);
    if (pair) pairs.set(categoryId, [pack(pair[0]), pack(pair[1])]);
  }
  return pairs;
}

// One category's lead pack, then a pack lying the same way from a later category
function acrossCategories(pairs: [Pack, Pack][]): [Pack, Pack] | null {
  for (const [i, [back]] of pairs.entries()) {
    const front = pairs.slice(i + 1).flat().find((p) => isFlat(p.aspect) === isFlat(back.aspect));
    if (front) return [back, front];
  }
  return null;
}

/** Each department's tile pair at this store: its first two chosen packs it stocks, else lead packs of two of its categories */
export async function pickDepartmentPairs(
  prisma: PrismaClient, storeId: string, region: string | null, departments: { id: string; categoryIds: string[] }[],
) {
  const [chosen, categoryPairs] = await Promise.all([
    chosenPacks(prisma, storeId, "departments", departments.map((d) => d.id)),
    pickPairs(prisma, storeId, region, departments.flatMap((d) => d.categoryIds)),
  ]);
  const pairs = new Map<string, [Pack, Pack]>();
  for (const { id, categoryIds } of departments) {
    const picked = chosen.filter((c) => c.ownerId === id);
    const pair = picked.length >= 2
      ? [pack(picked[0]), pack(picked[1])] as [Pack, Pack]
      : acrossCategories(categoryIds.flatMap((c) => (categoryPairs.has(c) ? [categoryPairs.get(c)!] : [])));
    if (pair) pairs.set(id, pair);
  }
  return pairs;
}
