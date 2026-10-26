import { STOREFRONT_MIN } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { flag, type CheckContext } from "./context.js";

const DAY_MS = 86_400_000;

/** Delivery choices, free delivery, loyalty, referral, membership and reviews waiting on the owner */
export async function serviceChecks({ prisma, store, now }: CheckContext) {
  const org = { organizationId: store.organizationId };
  const [express, slots, loyalty, referral, plans, waiting] = await Promise.all([
    prisma.expressDeliveryConfig.findUnique({ where: { storeId: store.id }, select: { isEnabled: true } }),
    prisma.deliverySlot.count({ where: { storeId: store.id, isActive: true } }),
    prisma.loyaltyConfig.findUnique({ where: org, select: { isEnabled: true } }),
    prisma.referralConfig.findUnique({ where: org, select: { isEnabled: true } }),
    prisma.membershipPlan.count({ where: { ...org, isActive: true } }),
    prisma.review.count({
      where: { storeId: store.id, status: "PENDING", createdAt: { lt: new Date(now.getTime() - STOREFRONT_MIN.REVIEW_WAIT_DAYS * DAY_MS) } },
    }),
  ]);
  const reviews: StorefrontCheckResult = waiting === 0
    ? { key: "REVIEWS", status: "ON", earned: 1 }
    : { key: "REVIEWS", status: "OFF", earned: 0, have: waiting };
  return [
    flag("DELIVERY", !!express?.isEnabled || slots > 0),
    flag("FREE_DELIVERY", Number(store.freeDeliveryThreshold ?? 0) > 0),
    flag("LOYALTY", !!loyalty?.isEnabled),
    flag("REFERRAL", !!referral?.isEnabled),
    flag("MEMBERSHIP", plans > 0),
    reviews,
  ];
}
