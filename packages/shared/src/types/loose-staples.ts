/** Where a loose staple's starting price came from: Martly's reference store, or the store's own branded packs in the aisle */
export type LooseStaplePriceSource = "REFERENCE" | "AISLE";

/** One size of an unbranded staple the store can sell loose or in its own packs */
export interface LooseStapleItem {
  variantId: string;
  productId: string;
  name: string;
  size: string;
  imageUrl: string | null;
  /** The store's listing, when it already sells this size */
  listed: { price: number; stock: number; isActive: boolean } | null;
  /** A starting price for the owner to adjust; null when nothing to go on */
  suggested: number | null;
  suggestedFrom: LooseStaplePriceSource | null;
}

export interface LooseStapleAisle {
  subcategoryId: string;
  name: string;
  category: string;
  items: LooseStapleItem[];
}
