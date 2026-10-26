import { STOREFRONT_MIN } from "@martly/shared/constants";
import { buyGetRow } from "../../home/buy-get.js";
import { flag, fromCount, liveWindow, notApplicable, type CheckContext } from "./context.js";

/** Buy X get Y, discounts, a Home coupon, member prices and a running promotion */
export async function dealsChecks({ prisma, store, now }: CheckContext) {
  const listings = { storeId: store.id, isActive: true };
  const [buyGet, discounts, coupons, hasPlan, memberPrices, promos] = await Promise.all([
    buyGetRow(prisma, store.id, now, 1),
    prisma.storeProduct.count({
      where: { ...listings, discountType: { not: null }, discountValue: { gt: 0 }, ...liveWindow(now, "discountStart", "discountEnd") },
    }),
    prisma.coupon.count({
      where: { organizationId: store.organizationId, isActive: true, showOnHome: true, ...liveWindow(now, "startsAt", "expiresAt") },
    }),
    prisma.membershipPlan.count({ where: { organizationId: store.organizationId, isActive: true } }),
    prisma.storeProduct.count({ where: { ...listings, memberPrice: { not: null } } }),
    prisma.promo.count({ where: { organizationId: store.organizationId, status: "LIVE" } }),
  ]);
  return [
    // The same count the Home hero card goes by
    fromCount("BUY_GET", buyGet.total, STOREFRONT_MIN.BUY_GET),
    fromCount("DISCOUNTS", discounts, STOREFRONT_MIN.DISCOUNTS),
    flag("COUPON", coupons > 0),
    hasPlan ? fromCount("MEMBER_PRICE", memberPrices, STOREFRONT_MIN.MEMBER_PRICES) : notApplicable("MEMBER_PRICE"),
    flag("PROMO", promos > 0),
  ];
}
