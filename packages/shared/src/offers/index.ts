/** Buy X get Y free: every `buy` paid units of a product bring `get` free ones */
export interface MultiBuyOffer {
  buy: number;
  get: number;
}

/** Units of `quantity` that come free under the offer */
export function freeUnits(quantity: number, offer: MultiBuyOffer | null | undefined): number {
  if (!offer) return 0;
  return Math.floor(quantity / (offer.buy + offer.get)) * offer.get;
}

/** What a line costs: only the units that aren't free are charged */
export function lineTotal(unitPrice: number, quantity: number, offer: MultiBuyOffer | null | undefined): number {
  return Math.round(unitPrice * (quantity - freeUnits(quantity, offer)) * 100) / 100;
}

/**
 * The nudge for a line part-way through an offer: "free" when the next `count` units cost nothing, "buy" when `count`
 * more paid units unlock the free ones; null when the line sits on a whole offer (or there is none)
 */
export function offerNudge(
  quantity: number,
  offer: MultiBuyOffer | null | undefined,
): { kind: "free" | "buy"; count: number } | null {
  if (!offer || quantity === 0) return null;
  const into = quantity % (offer.buy + offer.get);
  if (into === 0) return null;
  return into >= offer.buy ? { kind: "free", count: offer.buy + offer.get - into } : { kind: "buy", count: offer.buy - into };
}

/** What each unit of an order line actually cost, free units averaged in; the base for refunds */
export function paidPerUnit(line: { quantity: number; totalPrice: unknown }): number {
  return line.quantity > 0 ? Number(line.totalPrice) / line.quantity : 0;
}
