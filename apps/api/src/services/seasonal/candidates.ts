import type { PrismaClient } from "../../../generated/prisma/client.js";

const PER_SUBCATEGORY = 3;
const MAX_ITEMS = 16;

export interface SubcategoryCandidate {
  id: string;
  name: string;
  category: string;
  department: string;
  products: number;
}

/** Subcategories with something in stock at any of the org's active stores. */
export function orgSubcategoryCandidates(prisma: PrismaClient, organizationId: string) {
  return prisma.$queryRaw<SubcategoryCandidate[]>`
    SELECT sc.id, sc.name, c.name AS category, d.name AS department, COUNT(DISTINCT p.id)::int AS products
    FROM store_products sp
    JOIN stores s ON s.id = sp.store_id
    JOIN products p ON p.id = sp.product_id
    JOIN subcategories sc ON sc.id = p.subcategory_id
    JOIN categories c ON c.id = sc.category_id
    JOIN departments d ON d.id = c.department_id
    WHERE s.organization_id = ${organizationId} AND s.status = 'ACTIVE'
      AND sp.is_active AND sp.stock > 0 AND p.is_active
    GROUP BY sc.id, sc.name, c.name, d.name
    ORDER BY d.name, c.name, sc.name`;
}

/** Best sellers (30 days) then deepest stock per subcategory, interleaved in the curator's order. */
export async function pickProducts(prisma: PrismaClient, organizationId: string, subcategoryIds: string[]) {
  const rows = await prisma.$queryRaw<{ id: string; subcategory_id: string }[]>`
    SELECT p.id, p.subcategory_id
    FROM products p
    JOIN store_products sp ON sp.product_id = p.id
    JOIN stores s ON s.id = sp.store_id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN stores so ON so.id = o.store_id
      WHERE so.organization_id = ${organizationId} AND o.status <> 'CANCELLED'
        AND o.created_at > now() - interval '30 days'
      GROUP BY oi.product_id
    ) sales ON sales.product_id = p.id
    WHERE s.organization_id = ${organizationId} AND s.status = 'ACTIVE'
      AND sp.is_active AND sp.stock > 0 AND p.is_active AND p.subcategory_id = ANY(${subcategoryIds})
    GROUP BY p.id, p.subcategory_id, sales.qty
    ORDER BY COALESCE(sales.qty, 0) DESC, SUM(sp.stock) DESC`;
  const columns = subcategoryIds.map((sub) => rows.filter((r) => r.subcategory_id === sub).slice(0, PER_SUBCATEGORY));
  const ids: string[] = [];
  for (let i = 0; i < PER_SUBCATEGORY && ids.length < MAX_ITEMS; i++) {
    for (const column of columns) if (column[i] && ids.length < MAX_ITEMS) ids.push(column[i].id);
  }
  return ids;
}
