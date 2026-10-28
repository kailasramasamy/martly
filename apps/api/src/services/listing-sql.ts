import { Prisma } from "../../generated/prisma/client.js";

/** A store's listings with what they need for filtering and display: product, variant, aisle, department and brand */
export const LISTINGS = Prisma.sql`store_products sp
  JOIN products p ON p.id = sp.product_id
  JOIN product_variants v ON v.id = sp.variant_id
  LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
  LEFT JOIN categories c ON c.id = sc.category_id
  LEFT JOIN brands b ON b.id = p.brand_id`;

/** Prisma keeps timestamps as UTC wall time; a raw Date parameter would be read in the session's zone instead */
export const utc = (at: Date) => Prisma.sql`(${at.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
export const NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

/** Units each of the store's listings sold over 30 days, the main signal for what to look at first */
export const soldCte = (storeId: string) => Prisma.sql`sold AS (
  SELECT oi.store_product_id, SUM(oi.quantity)::int AS units
  FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > ${NOW_UTC} - interval '30 days'
  GROUP BY oi.store_product_id)`;

export const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

/** Listings the store sells or may sell: not ruled out, and not a hidden suggestion nobody has confirmed */
export const IN_RANGE = Prisma.sql`(sp.carried IS DISTINCT FROM false AND NOT (sp.suggested AND sp.carried IS NULL))`;
