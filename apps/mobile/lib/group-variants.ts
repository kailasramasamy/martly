import type { StoreProduct } from "./types";

export function effectivePrice(sp: StoreProduct): number {
  return sp.pricing?.discountActive ? sp.pricing.effectivePrice : Number(sp.price);
}

/**
 * The API returns one StoreProduct per variant (size). Product lists show one card per product:
 * `primary` holds each product's cheapest variant, `variantsByProductId` all its variants
 * (cheapest first) for the size picker.
 */
export function groupByProduct(storeProducts: StoreProduct[]) {
  const groups = new Map<string, StoreProduct[]>();
  for (const sp of storeProducts) {
    if (!sp.product) continue;
    const group = groups.get(sp.product.id);
    if (group) group.push(sp);
    else groups.set(sp.product.id, [sp]);
  }

  const primary: StoreProduct[] = [];
  const variantsByProductId = new Map<string, StoreProduct[]>();
  for (const [productId, variants] of groups) {
    const sorted = [...variants].sort((a, b) => effectivePrice(a) - effectivePrice(b));
    primary.push(sorted[0]);
    variantsByProductId.set(productId, sorted);
  }
  return { primary, variantsByProductId };
}

// How many of a product's variants are in the cart, across all sizes
export function cartQuantity(variants: StoreProduct[], cartQuantityMap: Map<string, number>) {
  return variants.reduce((sum, v) => sum + (cartQuantityMap.get(v.id) ?? 0), 0);
}
