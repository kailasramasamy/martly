import type { CouponOffer } from "@martly/shared/types";

/** The terms under an offer's headline, e.g. "Above ₹299 · up to ₹100" */
export function offerCondition(offer: CouponOffer): string {
  const parts: string[] = [];
  if (offer.minOrderAmount) parts.push(`Above ₹${offer.minOrderAmount}`);
  if (offer.maxDiscount) parts.push(`up to ₹${offer.maxDiscount}`);
  return parts.length > 0 ? parts.join(" · ") : "No minimum order";
}
