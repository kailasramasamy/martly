import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { priceLine, type PricedLine } from "../line-pricing.js";
import { advanceNextDeliveryDate } from "../../utils/subscription-dates.js";

const listingInclude = { include: { product: true, variant: true } } as const;
export const subscriptionInclude = { items: { include: { storeProduct: listingInclude } } } as const;
export type DueSubscription = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>;
type Listing = Prisma.StoreProductGetPayload<typeof listingInclude>;

export interface BasketLine extends PricedLine {
  storeProductId: string;
  productId: string;
  variantId: string;
  name: string;
  listing: Listing;
}

/** A delivery day: the UTC-midnight date the scheduler stores, and the end of it */
export interface DeliveryDay {
  start: Date;
  end: Date;
}

/** The first delivery date on or after `day`, stepping a missed date forward on the subscription's own rhythm */
export function catchUpDate(current: Date, frequency: string, selectedDays: number[], day: Date): Date {
  let next = current;
  while (next < day) next = advanceNextDeliveryDate(next, frequency, selectedDays);
  return next;
}

function line(sp: Listing, quantity: number, isMember: boolean): BasketLine {
  return {
    ...priceLine(sp, quantity, isMember),
    storeProductId: sp.id, productId: sp.productId, variantId: sp.variantId, name: sp.product.name, listing: sp,
  };
}

/**
 * Tomorrow's basket for a subscription: its items with that day's quantity changes, then the one-off add-ons,
 * priced like checkout (discounts, member price, buy X get Y). Subscription items come first, so they get the
 * wallet before add-ons when it runs short.
 */
export async function buildBasket(prisma: PrismaClient, sub: DueSubscription, day: DeliveryDay, isMember: boolean) {
  const [overrides, addOns] = await Promise.all([
    prisma.subscriptionItemOverride.findMany({ where: { subscriptionId: sub.id, deliveryDate: { gte: day.start, lt: day.end } } }),
    prisma.basketAddOn.findMany({
      where: { userId: sub.userId, storeId: sub.storeId, deliveryDate: { gte: day.start, lt: day.end } },
      include: { storeProduct: listingInclude },
    }),
  ]);
  const quantities = new Map<string, { sp: Listing; quantity: number }>();
  for (const item of sub.items) {
    const quantity = overrides.find((o) => o.storeProductId === item.storeProductId)?.quantity ?? item.quantity;
    if (quantity > 0) quantities.set(item.storeProductId, { sp: item.storeProduct, quantity });
  }
  for (const addOn of addOns) {
    const entry = quantities.get(addOn.storeProductId);
    if (entry) entry.quantity += addOn.quantity;
    else quantities.set(addOn.storeProductId, { sp: addOn.storeProduct, quantity: addOn.quantity });
  }
  const lines = [...quantities.values()].map(({ sp, quantity }) => line(sp, quantity, isMember));
  return { lines, hadOverrides: overrides.length > 0, hadAddOns: addOns.length > 0 };
}

/**
 * The part of the basket the wallet covers with the delivery fee: whole lines in order, then as many units of the
 * first line that doesn't fit as the balance allows. Lines left out (in full or in part) are named for the customer.
 */
export function fitToWallet(lines: BasketLine[], deliveryFee: number, balance: number, isMember: boolean) {
  const kept: BasketLine[] = [];
  const short: string[] = [];
  let total = deliveryFee;
  for (const l of lines) {
    if (total + l.totalPrice <= balance) {
      kept.push(l);
      total += l.totalPrice;
      continue;
    }
    short.push(l.name);
    for (let quantity = l.quantity - 1; quantity > 0; quantity--) {
      const smaller = line(l.listing, quantity, isMember);
      if (total + smaller.totalPrice <= balance) {
        kept.push(smaller);
        total += smaller.totalPrice;
        break;
      }
    }
  }
  return { kept, short };
}
