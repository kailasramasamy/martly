import type { CouponOffer } from "@martly/shared/types";
import type { Coupon, PrismaClient } from "../../generated/prisma/client.js";
import { couponDiscount, couponOpen } from "./coupons.js";

/** Home shows a handful; checkout lists every one the shopper could use */
export const HOME_OFFER_LIMIT = 6;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "Flat ₹50 off" or "20% off, up to ₹100" from the discount, for coupons without a headline of their own */
export function offerTitle(coupon: Pick<Coupon, "title" | "discountType" | "discountValue" | "maxDiscount">) {
  if (coupon.title) return coupon.title;
  const value = Number(coupon.discountValue);
  if (coupon.discountType === "FLAT") return `Flat ${rupees(value)} off`;
  return coupon.maxDiscount ? `${value}% off, up to ${rupees(Number(coupon.maxDiscount))}` : `${value}% off`;
}

type OfferTranslations = NonNullable<CouponOffer["translations"]>;

// A coupon without a headline gets one made from its discount in Tamil too, as it does in English
function offerTranslations(coupon: Coupon): OfferTranslations | null {
  const own = (coupon.translations ?? {}) as OfferTranslations;
  if (coupon.title) return Object.keys(own).length > 0 ? own : null;
  const value = Number(coupon.discountValue);
  const made = coupon.discountType === "FLAT"
    ? `${rupees(value)} தள்ளுபடி`
    : `${value}% தள்ளுபடி${coupon.maxDiscount ? `, அதிகபட்சம் ${rupees(Number(coupon.maxDiscount))}` : ""}`;
  return { ...own, ta: { ...own.ta, title: own.ta?.title || made } };
}

interface OfferQuery {
  organizationId: string;
  /** Empty for guests, who see every advertised coupon */
  userId: string;
  /** The cart's items total, to say which offers apply and what's missing */
  orderAmount?: number;
  limit?: number;
}

function toOffer(coupon: Coupon, orderAmount: number | undefined): CouponOffer {
  const minimum = coupon.minOrderAmount === null ? null : Number(coupon.minOrderAmount);
  const shortBy = orderAmount !== undefined && minimum !== null && orderAmount < minimum ? Math.ceil(minimum - orderAmount) : null;
  const eligible = orderAmount !== undefined && shortBy === null;
  return {
    code: coupon.code, title: offerTitle(coupon), description: coupon.description, translations: offerTranslations(coupon),
    discountType: coupon.discountType, discountValue: Number(coupon.discountValue), minOrderAmount: minimum,
    maxDiscount: coupon.maxDiscount === null ? null : Number(coupon.maxDiscount), expiresAt: coupon.expiresAt?.toISOString() ?? null,
    eligible, shortBy, discount: eligible ? couponDiscount(coupon, orderAmount!) : null,
  };
}

/**
 * The advertised coupons a shopper can still use at a store of this organisation: live, within their limits, and not
 * already used up by them. With a cart amount, the ones that apply come first, the biggest saving leading.
 */
export async function couponOffers(prisma: PrismaClient, query: OfferQuery): Promise<CouponOffer[]> {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: { showOnHome: true, isActive: true, OR: [{ organizationId: query.organizationId }, { organizationId: null }] },
    orderBy: [{ discountValue: "desc" }, { code: "asc" }],
  });
  const open = coupons.filter((c) => couponOpen(c, query.organizationId, now) === null);
  const used = query.userId
    ? await prisma.couponRedemption.groupBy({ by: ["couponId"], where: { userId: query.userId, couponId: { in: open.map((c) => c.id) } }, _count: true })
    : [];
  const usedCount = new Map(used.map((u) => [u.couponId, u._count]));
  const offers = open.filter((c) => (usedCount.get(c.id) ?? 0) < c.perUserLimit).map((c) => toOffer(c, query.orderAmount));
  if (query.orderAmount !== undefined) offers.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.discount ?? 0) - (a.discount ?? 0));
  return offers.slice(0, query.limit ?? offers.length);
}
