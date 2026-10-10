import type { StoreProduct } from "./types";

export interface BrandTile {
  id: string;
  name: string;
  count: number;
}

export const MIN_BRANDS_FOR_STRIP = 3;

interface BrandAccumulator {
  name: string;
  productIds: Set<string>;
}

function addProduct(acc: Map<string, BrandAccumulator>, { product }: StoreProduct): void {
  const brand = product.brand;
  if (!brand) return;
  let entry = acc.get(brand.id);
  if (!entry) {
    entry = { name: brand.name, productIds: new Set() };
    acc.set(brand.id, entry);
  }
  entry.productIds.add(product.id);
}

export function brandsFromProducts(products: StoreProduct[], max = 10): BrandTile[] {
  const acc = new Map<string, BrandAccumulator>();
  for (const sp of products) addProduct(acc, sp);
  return Array.from(acc, ([id, e]) => ({ id, name: e.name, count: e.productIds.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, max);
}
