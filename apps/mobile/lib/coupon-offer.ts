import type { CouponOffer } from "@martly/shared/types";
import { strings } from "./i18n";

/** The terms under an offer's headline, e.g. "Above ₹299 · up to ₹100" */
export function offerCondition(offer: CouponOffer): string {
  const t = strings("checkout").promo;
  const parts: string[] = [];
  if (offer.minOrderAmount) parts.push(t.above(offer.minOrderAmount));
  if (offer.maxDiscount) parts.push(t.upTo(offer.maxDiscount));
  return parts.length > 0 ? parts.join(" · ") : t.noMinimum;
}
