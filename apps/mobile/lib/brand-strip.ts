import type { StoreProduct } from "./types";

export interface BrandTile {
  id: string;
  name: string;
  imageUrl: string | null;
  count: number;
}

export const MIN_BRANDS_FOR_STRIP = 3;

interface BrandAccumulator {
  name: string;
  logo: string | null;
  productIds: Set<string>;
  bestImage: string | null;
  bestReviews: number;
}

function addProduct(acc: Map<string, BrandAccumulator>, { product }: StoreProduct): void {
  const brand = product.brand;
  if (!brand) return;
  let entry = acc.get(brand.id);
  if (!entry) {
    entry = { name: brand.name, logo: brand.imageUrl ?? null, productIds: new Set(), bestImage: null, bestReviews: -1 };
    acc.set(brand.id, entry);
  }
  entry.productIds.add(product.id);
  const reviews = product.reviewCount ?? 0;
  if (product.imageUrl && reviews > entry.bestReviews) {
    entry.bestImage = product.imageUrl;
    entry.bestReviews = reviews;
  }
}

export function brandsFromProducts(products: StoreProduct[], max = 10): BrandTile[] {
  const acc = new Map<string, BrandAccumulator>();
  for (const sp of products) addProduct(acc, sp);
  return Array.from(acc, ([id, e]) => ({ id, name: e.name, imageUrl: e.logo ?? e.bestImage, count: e.productIds.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, max);
}
