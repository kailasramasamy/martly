import type { Coupon, Prisma, PrismaClient } from "../../generated/prisma/client.js";

export type CouponCheck =
  | { ok: true; discount: number }
  /** `shortBy`: what the cart still needs to reach the coupon's minimum, when that's all that stands in the way */
  | { ok: false; reason: string; shortBy?: number };

interface CouponUse {
  userId: string;
  /** The organisation of the store the order is for */
  organizationId: string;
  orderAmount: number;
  now?: Date;
}

/** What a coupon takes off an order of this amount: flat or a percentage, capped by its maximum and by the order */
export function couponDiscount(coupon: Pick<Coupon, "discountType" | "discountValue" | "maxDiscount">, orderAmount: number) {
  const raw = coupon.discountType === "FLAT" ? Number(coupon.discountValue) : (orderAmount * Number(coupon.discountValue)) / 100;
  const capped = coupon.maxDiscount ? Math.min(raw, Number(coupon.maxDiscount)) : raw;
  return Math.round(Math.min(capped, orderAmount) * 100) / 100;
}

/** Everything but the shopper's own history: live, within its limits, for this store's organisation */
export function couponOpen(coupon: Coupon, organizationId: string, now = new Date()): string | null {
  if (!coupon.isActive) return "This coupon is no longer active";
  if (coupon.startsAt && now < coupon.startsAt) return "This coupon is not yet active";
  if (coupon.expiresAt && now > coupon.expiresAt) return "This coupon has expired";
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return "This coupon has reached its usage limit";
  if (coupon.organizationId && coupon.organizationId !== organizationId) return "This coupon is not valid for this store";
  return null;
}

/**
 * Whether a shopper can use a coupon on an order, and for how much. Checkout, the code box and the offers list all
 * decide through this, so they never disagree.
 */
export async function checkCoupon(prisma: PrismaClient | Prisma.TransactionClient, coupon: Coupon, use: CouponUse): Promise<CouponCheck> {
  const closed = couponOpen(coupon, use.organizationId, use.now);
  if (closed) return { ok: false, reason: closed };
  const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId: use.userId } });
  if (used >= coupon.perUserLimit) return { ok: false, reason: "You have already used this coupon" };
  const minimum = Number(coupon.minOrderAmount ?? 0);
  if (use.orderAmount < minimum) {
    return { ok: false, reason: `Minimum order amount is ₹${minimum}`, shortBy: Math.ceil(minimum - use.orderAmount) };
  }
  return { ok: true, discount: couponDiscount(coupon, use.orderAmount) };
}
