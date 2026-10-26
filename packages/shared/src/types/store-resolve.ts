/**
 * Why the store was picked: the one the shopper already uses, the nearest that delivers to them,
 * their town's main store, or the main store of Martly's default town
 */
export type StoreResolutionReason = "kept" | "nearest" | "town" | "default";

/** The picked store and the others the shopper can switch to; S is the API's store shape */
export interface StoreResolution<S> {
  store: S;
  reason: StoreResolutionReason;
  /** Known only when the shopper shared a location */
  deliversToYou: boolean | null;
  alternatives: S[];
}

/** Cart lines moved to another store: at its prices, plus the lines it doesn't sell */
export interface CartTransfer<L> {
  moved: (L & { quantity: number })[];
  missing: { productId: string; variantId: string; quantity: number }[];
}
