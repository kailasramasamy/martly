import type { StoreProduct } from "./types";
import { useStrings } from "./i18n/use-strings";

// From this saving the price is highlighted on the card
export const HIGHLIGHT_PERCENT = 20;
// A rupee figure reads better than a percentage once it's this big (and bigger than the percentage)
const FLAT_LABEL_MIN_RUPEES = 50;

export interface CardDeal {
  shown: number;
  struck: number | null;
  /** PROMO: against the store price (a promo or the member price). MRP: against the printed MRP. */
  kind: "PROMO" | "MRP" | null;
  savingRupees: number;
  savingPercent: number;
  highlight: boolean;
}

/** The price a card shows, what it is struck against, and how much the shopper saves */
export function cardDeal(item: StoreProduct, isMember: boolean): CardDeal {
  const promo = !!item.pricing?.discountActive;
  const storePrice = promo ? item.pricing!.effectivePrice : Number(item.price);
  const memberPrice = item.pricing?.memberPrice;
  const memberCheaper = isMember && memberPrice != null && memberPrice < storePrice;
  const shown = memberCheaper ? memberPrice : storePrice;
  // Money fields are Prisma decimals, which reach the app as strings
  const mrp = item.variant.mrp != null ? Number(item.variant.mrp) : null;

  let struck: number | null = null;
  let kind: CardDeal["kind"] = null;
  if (memberCheaper) { struck = storePrice; kind = "PROMO"; }
  else if (promo) { struck = item.pricing!.originalPrice; kind = "PROMO"; }
  else if (mrp != null && mrp > shown) { struck = mrp; kind = "MRP"; }

  const savingPercent = struck != null && struck > shown ? Math.round(((struck - shown) / struck) * 100) : 0;
  if (savingPercent < 1) return { shown, struck: null, kind: null, savingRupees: 0, savingPercent: 0, highlight: false };
  return {
    shown, struck, kind,
    savingRupees: Math.round(struck! - shown),
    savingPercent,
    highlight: savingPercent >= HIGHLIGHT_PERCENT,
  };
}

/** Turns a deal into its badge text: "₹N OFF" for big rupee savings, else "N% OFF" (on MRP when struck against it) */
export function useDealLabel() {
  const tc = useStrings("common");
  const t = useStrings("catalog");
  return (deal: CardDeal): string | null => {
    if (deal.kind == null) return null;
    if (deal.savingRupees >= FLAT_LABEL_MIN_RUPEES && deal.savingRupees > deal.savingPercent) return t.flatOff(deal.savingRupees);
    return deal.kind === "PROMO" ? tc.percentOff(deal.savingPercent) : tc.percentOffMrp(deal.savingPercent);
  };
}
