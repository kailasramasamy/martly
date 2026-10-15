import type { CatalogProduct } from "./types";

export interface StoreListing {
  /** Variants of the product that already have a listing in the store */
  listedVariantIds: string[];
  /** A listing to open when the product is already in the store */
  firstListingId: string | null;
  state: "none" | "partial" | "full";
}

/** How much of a catalog product is already listed in one store */
export function storeListing(product: CatalogProduct, storeId: string): StoreListing {
  const here = (product.storeProducts ?? []).filter((sp) => sp.storeId === storeId);
  const listedVariantIds = product.variants.map((v) => v.id).filter((id) => here.some((sp) => sp.variantId === id));
  let state: StoreListing["state"] = "none";
  if (listedVariantIds.length > 0) state = listedVariantIds.length === product.variants.length ? "full" : "partial";
  return { listedVariantIds, firstListingId: here[0]?.id ?? null, state };
}
