/** One store's listing of one variant, as returned with `includeStoreProducts=true` */
export interface VariantListing {
  storeId: string;
  isActive: boolean;
  stock: number;
  reservedStock: number;
}

export type ListingState =
  | { kind: "listed" | "outOfStock" | "hidden" | "notListed" }
  | { kind: "stores"; count: number };

/**
 * How a product sits in a store's range. A product is listed when any of its variants is;
 * it's live when an active variant has stock. Without a store, counts the stores that list it.
 */
export function listingState(listings: readonly VariantListing[], storeId?: string | null): ListingState {
  if (!storeId) {
    const stores = new Set(listings.map((l) => l.storeId)).size;
    return stores > 0 ? { kind: "stores", count: stores } : { kind: "notListed" };
  }
  const here = listings.filter((l) => l.storeId === storeId);
  if (here.length === 0) return { kind: "notListed" };
  const active = here.filter((l) => l.isActive);
  if (active.length === 0) return { kind: "hidden" };
  return active.some((l) => l.stock - l.reservedStock > 0) ? { kind: "listed" } : { kind: "outOfStock" };
}

export function listingLabel(state: ListingState): string {
  switch (state.kind) {
    case "listed": return "Listed";
    case "outOfStock": return "Out of stock";
    case "hidden": return "Hidden";
    case "notListed": return "Not listed";
    case "stores": return `In ${state.count} store${state.count === 1 ? "" : "s"}`;
  }
}
