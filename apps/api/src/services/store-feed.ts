import type { PrismaClient } from "../../generated/prisma/client.js";
import { calculateEffectivePrice } from "./pricing.js";
import { formatVariantUnit } from "./units.js";

export const STORE_PRODUCT_INCLUDE = {
  product: { include: { subcategory: true, brand: true, variants: true } },
  variant: true,
};

export function enrichStoreProduct(sp: any) {
  const pricing = calculateEffectivePrice(
    sp.price as unknown as number,
    sp.variant as Parameters<typeof calculateEffectivePrice>[1],
    sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
  );
  const variant = formatVariantUnit(sp.variant);
  return { ...sp, variant, pricing, availableStock: sp.stock - sp.reservedStock };
}

export function buildProductData(p: any) {
  return {
    id: p.id, name: p.name, description: p.description, imageUrl: p.imageUrl,
    brand: p.brand, foodType: p.foodType, productType: p.productType,
    regulatoryMarks: p.regulatoryMarks, certifications: p.certifications,
    dangerWarnings: p.dangerWarnings, subcategory: p.subcategory, variants: p.variants,
    translations: p.translations,
  };
}

// The app groups rows by product and offers a size picker, so feed sections send all active sizes
export async function withAllSizes(prisma: PrismaClient, storeId: string, rows: { productId: string }[]) {
  const productIds = [...new Set(rows.map((r) => r.productId))];
  if (productIds.length === 0) return [];
  const all = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, productId: { in: productIds } },
    include: STORE_PRODUCT_INCLUDE,
  });
  const byProduct = new Map<string, any[]>();
  for (const sp of all) byProduct.set(sp.productId, [...(byProduct.get(sp.productId) ?? []), sp]);
  return productIds.flatMap((id) => (byProduct.get(id) ?? []).map(enrichStoreProduct));
}

export async function reviewSummaries(prisma: PrismaClient, productIds: string[]) {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return new Map<string, { averageRating: number; reviewCount: number }>();
  const aggs = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: unique }, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(aggs.map((r) => [r.productId, { averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10, reviewCount: r._count.rating }]));
}

export function withReviews(items: any[], reviews: Map<string, { averageRating: number; reviewCount: number }>) {
  return items.map((item) => {
    const rev = reviews.get(item.productId);
    return rev ? { ...item, product: { ...item.product, averageRating: rev.averageRating, reviewCount: rev.reviewCount } } : item;
  });
}

// Scheduled collections (occasions, seasons) are only live inside their window; open bounds never expire
export function liveWindow(now: Date) {
  return [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ];
}
