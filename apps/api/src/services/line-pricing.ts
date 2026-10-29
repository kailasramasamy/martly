import type { PrismaClient } from "../../generated/prisma/client.js";
import { freeUnits, lineTotal } from "@martly/shared/offers";
import { calculateEffectivePrice, type PricingResult } from "./pricing.js";

type VariantDiscount = Parameters<typeof calculateEffectivePrice>[1];
type ListingDiscount = Parameters<typeof calculateEffectivePrice>[2];

/** A store listing with its variant: price, discounts, member price and buy X get Y fields */
export type PricedListing = NonNullable<ListingDiscount> & {
  price: { toString(): string } | number;
  memberPrice: { toString(): string } | number | null;
  variant: NonNullable<VariantDiscount>;
};

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  /** Units the buy X get Y offer gives free, already left out of totalPrice */
  freeQuantity: number;
  totalPrice: number;
  pricing: PricingResult;
}

/**
 * What a line costs: the listing's discount, the member price for members, and buy X get Y free units. Checkout,
 * subscription orders and the subscription basket preview all price through this, so they charge the same.
 */
export function priceLine(sp: PricedListing, quantity: number, isMember: boolean): PricedLine {
  const memberPrice = sp.memberPrice == null ? null : Number(sp.memberPrice);
  const pricing = calculateEffectivePrice(Number(sp.price), sp.variant, sp, memberPrice);
  const unitPrice = isMember && memberPrice != null ? Math.min(pricing.effectivePrice, memberPrice) : pricing.effectivePrice;
  return {
    unitPrice,
    quantity,
    freeQuantity: freeUnits(quantity, pricing.offer),
    totalPrice: lineTotal(unitPrice, quantity, pricing.offer),
    pricing,
  };
}

/** The customer's live membership in an organisation: member prices, and free delivery when the plan has it */
export async function memberBenefits(prisma: PrismaClient, userId: string, organizationId: string) {
  const membership = await prisma.userMembership.findFirst({
    where: { userId, organizationId, status: "ACTIVE", endDate: { gt: new Date() } },
    include: { plan: true },
  });
  return { isMember: !!membership, freeDelivery: !!membership?.plan.freeDelivery, plan: membership?.plan ?? null };
}

/** The delivery fee after the store's free-delivery threshold and the member's free delivery */
export function deliveryFeeAfterWaivers(
  fee: number,
  itemsTotal: number,
  freeDeliveryThreshold: { toString(): string } | number | null,
  memberFreeDelivery: boolean,
): number {
  if (memberFreeDelivery) return 0;
  if (freeDeliveryThreshold != null && itemsTotal >= Number(freeDeliveryThreshold)) return 0;
  return fee;
}
