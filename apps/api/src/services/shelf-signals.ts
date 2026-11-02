import type { ShelfSignals } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

// Sold at least this many in 30 days to be called the aisle's bestseller
const BESTSELLER_MIN = 5;
// Trending: at least this many sold in 7 days, at this multiple of its 30-day weekly pace
const TRENDING_MIN = 3;
const TRENDING_PACE = 1.5;
// "N bought this week" only from this many shoppers, so a new store's shelves never look empty
const SHOPPERS_MIN = 5;
// New: listed in the last 21 days, once the store had been open 21 days (everything is new at a store's launch), on a
// day the store listed at most 20 products (more is a stock check or catalog import, not new arrivals)
const NEW_DAYS = 21;
const BULK_DAY = 20;
// Low stock, as the stickers say "Only N left"
const LOW_STOCK = 5;
// A full shelf holds a month's sales, and never fewer than this
const FULL_MIN = 10;

type Shown = { id: string; productId: string; availableStock: number };
type Sales = { productId: string; units30: number; units7: number; shoppers7: number };

// 30- and 7-day sales here for the products on show
function salesOf(prisma: PrismaClient, storeId: string, productIds: string[]) {
  return prisma.$queryRaw<Sales[]>`
    SELECT oi.product_id AS "productId", SUM(oi.quantity)::int AS units30,
      COALESCE(SUM(oi.quantity) FILTER (WHERE o.created_at > now() - interval '7 days'), 0)::int AS units7,
      COUNT(DISTINCT o.user_id) FILTER (WHERE o.created_at > now() - interval '7 days')::int AS shoppers7
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
      AND oi.product_id = ANY(${productIds}::text[])
    GROUP BY oi.product_id`;
}

// The aisle's (or the picked subcategory's) best seller over 30 days, if it sold enough to be called one
async function bestsellerIn(prisma: PrismaClient, storeId: string, categoryId: string, subcategoryId: string | undefined) {
  const [best] = await prisma.$queryRaw<{ productId: string }[]>`
    SELECT oi.product_id AS "productId"
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN subcategories s ON s.id = p.subcategory_id AND s.category_id = ${categoryId}
      ${subcategoryId ? Prisma.sql`AND s.id = ${subcategoryId}` : Prisma.empty}
    WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
    GROUP BY oi.product_id
    HAVING SUM(oi.quantity) >= ${BESTSELLER_MIN}
    ORDER BY SUM(oi.quantity) DESC, oi.product_id
    LIMIT 1`;
  return best?.productId ?? null;
}

// The listings on show that are new here
async function newListings(prisma: PrismaClient, storeId: string, storeProductIds: string[]) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT sp.id, COUNT(*) OVER (PARTITION BY date_trunc('day', sp.created_at)) AS listed_that_day
      FROM store_products sp JOIN stores st ON st.id = sp.store_id
      WHERE sp.store_id = ${storeId}
        AND sp.created_at > now() - make_interval(days => ${NEW_DAYS}::int)
        AND sp.created_at > COALESCE(st.launched_at, st.created_at) + make_interval(days => ${NEW_DAYS}::int)
    ) recent
    WHERE listed_that_day <= ${BULK_DAY} AND id = ANY(${storeProductIds}::text[])`;
  return new Set(rows.map((r) => r.id));
}

function stockLevel(available: number, units30: number): ShelfSignals["stockLevel"] {
  if (available <= LOW_STOCK) return "low";
  return available >= Math.max(FULL_MIN, units30) ? "full" : "half";
}

/**
 * What each pack on an aisle's shelves calls out (bestseller, trending, new, shoppers this week) and how full its shelf
 * looks, from the store's own sales. The bestseller is the aisle's, or the picked subcategory's
 */
export async function withShelfSignals<T extends Shown>(
  prisma: PrismaClient, storeId: string, scope: { categoryId: string; subcategoryId?: string }, lists: T[][],
) {
  const shown = lists.flat();
  if (shown.length === 0) return lists.map(() => [] as (T & { shelf: ShelfSignals })[]);
  const [sales, best, fresh] = await Promise.all([
    salesOf(prisma, storeId, [...new Set(shown.map((sp) => sp.productId))]),
    bestsellerIn(prisma, storeId, scope.categoryId, scope.subcategoryId),
    newListings(prisma, storeId, shown.map((sp) => sp.id)),
  ]);
  const byProduct = new Map(sales.map((s) => [s.productId, s]));
  const signals = (sp: T): ShelfSignals => {
    const s = byProduct.get(sp.productId);
    const units30 = s?.units30 ?? 0;
    const units7 = s?.units7 ?? 0;
    return {
      bestseller: sp.productId === best,
      trending: units7 >= TRENDING_MIN && units7 > ((units30 * 7) / 30) * TRENDING_PACE,
      boughtThisWeek: s && s.shoppers7 >= SHOPPERS_MIN ? s.shoppers7 : null,
      isNew: fresh.has(sp.id),
      stockLevel: stockLevel(sp.availableStock, units30),
    };
  };
  return lists.map((list) => list.map((sp) => ({ ...sp, shelf: signals(sp) })));
}
