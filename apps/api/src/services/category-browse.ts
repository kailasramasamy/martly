import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import type { CategoryFacets } from "@martly/shared/types";
import { ownBrandId } from "@martly/shared/constants";
import { storeBrandBoost, type BrandBoost } from "./brand-boost.js";
import { storeBrandLabel } from "./store-brand-names.js";

// A browse node is a department, category or subcategory id; products hang off subcategories only
export async function subcategoryIdsUnder(prisma: PrismaClient, nodeId: string): Promise<string[]> {
  const dept = await prisma.department.findUnique({ where: { id: nodeId }, select: { id: true } });
  const categoryWhere = dept ? { departmentId: nodeId } : { id: nodeId };
  const subs = await prisma.subcategory.findMany({ where: { category: categoryWhere }, select: { id: true } });
  return subs.length > 0 ? subs.map((s) => s.id) : [nodeId];
}

// How many products a store lists in each subcategory under a node, and every brand there, most products first
export async function categoryFacets(prisma: PrismaClient, storeId: string, nodeId: string): Promise<CategoryFacets> {
  const subIds = await subcategoryIdsUnder(prisma, nodeId);
  const listed = Prisma.sql`
    FROM store_products sp JOIN products p ON p.id = sp.product_id LEFT JOIN brands b ON b.id = p.brand_id
    WHERE sp.store_id = ${storeId} AND sp.is_active AND p.subcategory_id IN (${Prisma.join(subIds)})`;
  const [counts, brands] = await Promise.all([
    prisma.$queryRaw<{ id: string; count: bigint }[]>`
      SELECT p.subcategory_id AS id, COUNT(DISTINCT p.id) AS count ${listed} GROUP BY p.subcategory_id`,
    prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null; count: bigint }[]>`
      SELECT b.id, b.name, b.image_url AS "imageUrl", COUNT(DISTINCT p.id) AS count
      ${listed} AND b.id IS NOT NULL
      GROUP BY b.id ORDER BY count DESC, b.name`,
  ]);
  const boost = await storeBrandBoost(prisma, storeId);
  const own = await ownBrandFacet(prisma, storeId, subIds, boost);
  return {
    subcategoryCounts: Object.fromEntries(counts.map((c) => [c.id, Number(c.count)])),
    brands: [...(own ? [own] : []), ...brands.filter((b) => !boost.ownBrandIds.includes(b.id)).map((b) => ({ ...b, count: Number(b.count) }))],
  };
}

/** The store's own brand as the first brand under a node: its brands and the staples it packs, under its logo */
async function ownBrandFacet(prisma: PrismaClient, storeId: string, subIds: string[], boost: BrandBoost) {
  const staples = subIds.filter((id) => boost.stapleSubcategoryIds.includes(id));
  if (!boost.ownBrandIds.length && !staples.length) return null;
  const ownProduct: Prisma.ProductWhereInput = { OR: [{ brandId: { in: boost.ownBrandIds } }, { brandId: null, subcategoryId: { in: staples } }] };
  const [count, store] = await Promise.all([
    prisma.product.count({ where: { subcategoryId: { in: subIds }, storeProducts: { some: { storeId, isActive: true } }, ...ownProduct } }),
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true, logoUrl: true } }),
  ]);
  return count && store ? { id: ownBrandId(storeId), name: storeBrandLabel(storeId, store.name), imageUrl: store.logoUrl, count } : null;
}
