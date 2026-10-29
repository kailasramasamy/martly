import type { Coupon, OrderStatus, PaymentStatus, Prisma } from "../../generated/prisma/client.js";
import { checkCoupon, type CouponCheck } from "./coupons.js";

type Tx = Prisma.TransactionClient;

export function conflict(message: string) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

/**
 * Moves an order out of the status (and payment status) it was read in, or throws 409 when another request moved it
 * first. Call it first in the transaction: the row stays locked until commit, so the side effects that follow run once.
 */
export async function claimStatus(
  tx: Tx,
  orderId: string,
  from: { status: OrderStatus; paymentStatus: PaymentStatus },
  to: OrderStatus,
) {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: from.status, paymentStatus: from.paymentStatus },
    data: { status: to },
  });
  if (count === 0) throw conflict("This order was just updated. Refresh and try again.");
}

/** The wallet balance, with the user's row locked so concurrent orders and debits spend it one at a time */
export async function lockWalletBalance(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ wallet_balance: Prisma.Decimal }[]>`
    SELECT wallet_balance FROM users WHERE id = ${userId} FOR UPDATE`;
  return Number(rows[0]?.wallet_balance ?? 0);
}

/** The points balance in an organisation, locked the same way; null when the customer has none there */
export async function lockLoyaltyPoints(tx: Tx, userId: string, organizationId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<{ points: number }[]>`
    SELECT points FROM loyalty_balances WHERE user_id = ${userId} AND organization_id = ${organizationId} FOR UPDATE`;
  return rows[0]?.points ?? null;
}

/** Re-checks a coupon with its row locked, so its global and per-shopper limits hold under concurrent checkouts */
export async function lockCoupon(tx: Tx, couponId: string, use: Parameters<typeof checkCoupon>[2]): Promise<CouponCheck> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
  if (rows.length === 0) return { ok: false, reason: "This coupon is no longer available" };
  const coupon: Coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
  return checkCoupon(tx, coupon, use);
}

/** Gives a cancelled order's coupon use back, so the shopper and the coupon's limit get it again */
export async function releaseCoupon(tx: Tx, order: { id: string; couponId: string | null }) {
  if (!order.couponId) return;
  const { count } = await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
  if (count > 0) await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: count } } });
}
