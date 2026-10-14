import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

const LIST_LIMIT = 40;

export interface ProductFacts {
  id: string;
  name: string;
  brand: string | null;
  subcategory: string | null;
  image_url: string | null;
  price_min: number;
  price_max: number;
  stores_in_stock: number;
  sold_30d: number;
  best_discount: string | null;
}

// A listing's discount counts when it has a value and its window covers now
const activeDiscount = Prisma.sql`sp.discount_type IS NOT NULL AND sp.discount_value > 0
  AND (sp.discount_start IS NULL OR sp.discount_start <= now()) AND (sp.discount_end IS NULL OR sp.discount_end >= now())`;

const orgListing = (organizationId: string) => Prisma.sql`
  JOIN store_products sp ON sp.product_id = p.id AND sp.is_active
  JOIN stores s ON s.id = sp.store_id AND s.organization_id = ${organizationId} AND s.status = 'ACTIVE'`;

const orgSales = (organizationId: string) => Prisma.sql`
  LEFT JOIN (
    SELECT oi.product_id, SUM(oi.quantity)::int AS qty
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN stores so ON so.id = o.store_id
    WHERE so.organization_id = ${organizationId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
    GROUP BY oi.product_id
  ) sales ON sales.product_id = p.id`;

/** The org's store with the widest catalogue; searches run against it. */
export async function referenceStoreId(prisma: PrismaClient, organizationId: string) {
  const [row] = await prisma.$queryRaw<{ store_id: string }[]>`
    SELECT sp.store_id FROM store_products sp JOIN stores s ON s.id = sp.store_id
    WHERE s.organization_id = ${organizationId} AND s.status = 'ACTIVE' AND sp.is_active
    GROUP BY sp.store_id ORDER BY COUNT(*) DESC LIMIT 1`;
  return row?.store_id ?? null;
}

/** Price range, stock reach, sales and current discount of each product across the org's active stores. */
export async function describeProducts(prisma: PrismaClient, organizationId: string, productIds: string[]) {
  if (productIds.length === 0) return [];
  return prisma.$queryRaw<ProductFacts[]>`
    SELECT p.id, p.name, b.name AS brand, sc.name AS subcategory, p.image_url,
      MIN(sp.price)::float AS price_min, MAX(sp.price)::float AS price_max,
      COUNT(DISTINCT sp.store_id) FILTER (WHERE sp.stock > 0)::int AS stores_in_stock,
      COALESCE(sales.qty, 0)::int AS sold_30d,
      MAX(CASE WHEN sp.discount_type = 'PERCENTAGE' THEN sp.discount_value::int || '%' ELSE '₹' || sp.discount_value::int END)
        FILTER (WHERE ${activeDiscount}) AS best_discount
    FROM products p
    ${orgListing(organizationId)}
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
    ${orgSales(organizationId)}
    WHERE p.is_active AND p.id = ANY(${productIds})
    GROUP BY p.id, b.name, sc.name, sales.qty
    ORDER BY array_position(${productIds}::text[], p.id)`;
}

/** One line per product, the way the agent reads the catalogue. */
export function productLines(products: ProductFacts[]) {
  if (products.length === 0) return "No matching products are listed in this organisation's stores.";
  const rupees = (n: number) => `₹${Math.round(n)}`;
  return products.map((p) => [
    p.id, p.name, p.brand ?? "no brand", p.subcategory ?? "-",
    p.price_min === p.price_max ? rupees(p.price_min) : `${rupees(p.price_min)}-${rupees(p.price_max)}`,
    `in stock at ${p.stores_in_stock} stores`, `sold 30d: ${p.sold_30d}`,
    p.best_discount ? `on sale: ${p.best_discount} off` : "no discount",
  ].join(" | ")).join("\n");
}

/** Best sellers, then widest stock reach, among a subcategory's in-stock products. */
export async function subcategoryProductIds(prisma: PrismaClient, organizationId: string, subcategoryId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    ${orgListing(organizationId)}
    ${orgSales(organizationId)}
    WHERE p.is_active AND sp.stock > 0 AND p.subcategory_id = ${subcategoryId}
    GROUP BY p.id, sales.qty
    ORDER BY COALESCE(sales.qty, 0) DESC, COUNT(DISTINCT sp.store_id) DESC, p.id
    LIMIT ${LIST_LIMIT}`;
  return rows.map((r) => r.id);
}

/** In-stock products that already carry a live discount, most popular first. */
export async function onSaleProductIds(prisma: PrismaClient, organizationId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    ${orgListing(organizationId)}
    ${orgSales(organizationId)}
    WHERE p.is_active AND sp.stock > 0 AND ${activeDiscount}
    GROUP BY p.id, sales.qty
    ORDER BY COALESCE(sales.qty, 0) DESC, COUNT(DISTINCT sp.store_id) DESC, p.id
    LIMIT ${LIST_LIMIT}`;
  return rows.map((r) => r.id);
}
