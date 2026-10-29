import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import type { CategoryFacets } from "@martly/shared/types";

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
  return {
    subcategoryCounts: Object.fromEntries(counts.map((c) => [c.id, Number(c.count)])),
    brands: brands.map((b) => ({ ...b, count: Number(b.count) })),
  };
}
