import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { utc } from "./listing-sql.js";
import { ttlCache } from "./ttl-cache.js";

/** Order lines per product, as parallel arrays so a query can join them as a table (salesTable) */
export type ProductSales = { productIds: string[]; counts: number[] };

// Counts are rebuilt from the order history at most this often; rankings that use them lag that long
const SALES_TTL_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const lifetimeCache = ttlCache<ProductSales>(SALES_TTL_MS);
const recentCache = ttlCache<ProductSales>(SALES_TTL_MS);

async function countLines(prisma: PrismaClient, where: Prisma.Sql): Promise<ProductSales> {
  const rows = await prisma.$queryRaw<{ product_id: string; n: number }[]>`
    SELECT oi.product_id, COUNT(*)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE ${where} GROUP BY oi.product_id`;
  return { productIds: rows.map((r) => r.product_id), counts: rows.map((r) => r.n) };
}

/** Every order line (cancelled orders aside) each product has at the store, or across every store without one */
export function lifetimeSales(prisma: PrismaClient, storeId: string | undefined) {
  return lifetimeCache.get(storeId ?? "*", () => countLines(prisma, Prisma.sql`
    ${storeId ? Prisma.sql`o.store_id = ${storeId}` : Prisma.sql`TRUE`} AND o.status <> 'CANCELLED'`));
}

/** Order lines of any status each product has at the store over the last `days` days */
export function recentSales(prisma: PrismaClient, storeId: string, days: number) {
  return recentCache.get(`${storeId}:${days}`, () => countLines(prisma, Prisma.sql`
    o.store_id = ${storeId} AND o.created_at >= ${utc(new Date(Date.now() - days * DAY_MS))}`));
}

/** The counts as a `(product_id, n)` table for a FROM or JOIN */
export const salesTable = (sales: ProductSales) =>
  Prisma.sql`(SELECT * FROM unnest(${sales.productIds}::text[], ${sales.counts}::int[]) AS s(product_id, n))`;
