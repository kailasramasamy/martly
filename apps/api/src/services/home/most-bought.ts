import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { storeListings } from "../store-feed.js";

/** Units of each product sold at a store over the last 30 days, cancelled orders aside: `product_id`, `qty` */
export function recentStoreSales(storeId: string) {
  return Prisma.sql`
    SELECT oi.product_id, SUM(oi.quantity) AS qty
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
    GROUP BY oi.product_id`;
}

/**
 * The store's best sellers over 30 days that it has in stock now, each as its best-stocked size; only products that
 * actually sold count, so the list never pads itself with guesses
 */
export async function mostBought(prisma: PrismaClient, storeId: string, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT DISTINCT ON (p.id) sp.id, sales.qty
      FROM (${recentStoreSales(storeId)}) sales
      JOIN products p ON p.id = sales.product_id AND p.is_active
      JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0
      ORDER BY p.id, sp.stock DESC
    ) best
    ORDER BY qty DESC, id
    LIMIT ${limit}`;
  return storeListings(prisma, rows.map((r) => r.id));
}
