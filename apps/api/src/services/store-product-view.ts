import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { calculateEffectivePrice } from "./pricing.js";
import { formatVariantUnit } from "./units.js";

export const storeProductInclude = {
  product: { include: { subcategory: true, variants: true, brand: { select: { id: true, name: true, imageUrl: true } } } },
  variant: true,
} satisfies Prisma.StoreProductInclude;

type StoreProductRow = Prisma.StoreProductGetPayload<{ include: typeof storeProductInclude }>;

async function reviewAggregates(prisma: PrismaClient, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { averageRating: number; reviewCount: number }>();
  const aggs = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(aggs.map((r) => [r.productId, {
    averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10,
    reviewCount: r._count.rating,
  }]));
}

const BESTSELLER_LIMIT = 20;
const BESTSELLER_MIN_UNITS = 3;
const BESTSELLER_TTL_MS = 10 * 60_000;
const bestsellerCache = new Map<string, { at: number; ids: Set<string> }>();

// A store's top sellers by units over 30 days; earns the "Bestseller" badge on cards
async function bestsellers(prisma: PrismaClient, storeId: string) {
  const cached = bestsellerCache.get(storeId);
  if (cached && Date.now() - cached.at < BESTSELLER_TTL_MS) return cached.ids;
  const rows = await prisma.$queryRaw<{ product_id: string }[]>`
    SELECT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
    GROUP BY oi.product_id
    HAVING SUM(oi.quantity) >= ${BESTSELLER_MIN_UNITS}
    ORDER BY SUM(oi.quantity) DESC
    LIMIT ${BESTSELLER_LIMIT}`;
  const ids = new Set(rows.map((r) => r.product_id));
  bestsellerCache.set(storeId, { at: Date.now(), ids });
  return ids;
}

/** Shape store-product rows for customers: effective pricing, formatted unit, review aggregates, available stock, bestseller flag. */
export async function decorateStoreProducts(prisma: PrismaClient, rows: StoreProductRow[]) {
  const storeIds = [...new Set(rows.map((sp) => sp.storeId))];
  const [reviewMap, ...topSellers] = await Promise.all([
    reviewAggregates(prisma, [...new Set(rows.map((sp) => sp.productId))]),
    ...storeIds.map((id) => bestsellers(prisma, id)),
  ]);
  const topByStore = new Map(storeIds.map((id, i) => [id, topSellers[i]]));
  return rows.map((sp) => {
    const pricing = calculateEffectivePrice(
      sp.price as unknown as number,
      sp.variant as Parameters<typeof calculateEffectivePrice>[1],
      sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      sp.memberPrice as unknown as number | null,
    );
    const reviews = reviewMap.get(sp.productId);
    const isBestseller = topByStore.get(sp.storeId)?.has(sp.productId) ?? false;
    const product = { ...sp.product, ...reviews, isBestseller };
    return { ...sp, product, variant: formatVariantUnit(sp.variant), pricing, availableStock: sp.stock - sp.reservedStock };
  });
}

export type StoreProductView = Awaited<ReturnType<typeof decorateStoreProducts>>[number];
