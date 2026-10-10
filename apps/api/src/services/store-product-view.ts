import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { calculateEffectivePrice } from "./pricing.js";
import { formatVariantUnit } from "./units.js";

export const storeProductInclude = {
  product: { include: { subcategory: true, variants: true, brand: { select: { id: true, name: true } } } },
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

/** Shape store-product rows for customers: effective pricing, formatted unit, review aggregates, available stock. */
export async function decorateStoreProducts(prisma: PrismaClient, rows: StoreProductRow[]) {
  const reviewMap = await reviewAggregates(prisma, [...new Set(rows.map((sp) => sp.productId))]);
  return rows.map((sp) => {
    const pricing = calculateEffectivePrice(
      sp.price as unknown as number,
      sp.variant as Parameters<typeof calculateEffectivePrice>[1],
      sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      sp.memberPrice as unknown as number | null,
    );
    const reviews = reviewMap.get(sp.productId);
    const product = reviews ? { ...sp.product, ...reviews } : sp.product;
    return { ...sp, product, variant: formatVariantUnit(sp.variant), pricing, availableStock: sp.stock - sp.reservedStock };
  });
}

export type StoreProductView = Awaited<ReturnType<typeof decorateStoreProducts>>[number];
