import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { createRazorpayOrder, ensureRazorpayCustomer, paymentMismatch, type RazorpayPayment } from "./payment.js";
import { postEntries } from "./ledger/post.js";
import { notifyMembershipWelcome } from "./notify/service-alerts.js";

export const DURATION_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUAL: 365,
};

interface PurchaseStart {
  userId: string;
  organizationId: string;
  planId: string;
  /** Set for an upgrade: the membership the new plan replaces */
  previousMembershipId?: string;
  /** Rupees: the plan price, or the upgrade charge after the unused credit */
  amount: number;
}

/** Raises the Razorpay order for a membership checkout and records what it buys, so verify reads the plan from here */
export async function startMembershipPurchase(app: FastifyInstance, start: PurchaseStart) {
  const amountInPaise = Math.round(start.amount * 100);
  const receipt = `${start.previousMembershipId ? "mem_upg" : "mem"}_${start.userId.slice(0, 8)}_${Date.now()}`;
  const customerId = await ensureRazorpayCustomer(app.prisma, start.userId);
  const rpOrder = await createRazorpayOrder(amountInPaise, receipt, customerId);
  await app.prisma.membershipPurchase.create({
    data: { ...start, amount: amountInPaise / 100, razorpayOrderId: rpOrder.id },
  });
  return { razorpayOrderId: rpOrder.id, amountInPaise, customerId };
}

type Tx = Prisma.TransactionClient;
type Purchase = Prisma.MembershipPurchaseGetPayload<{ include: { plan: true } }>;

async function activate(tx: Tx, purchase: Purchase, paymentId: string) {
  // An upgrade replaces the membership only if it is still the live one
  const replaced = purchase.previousMembershipId
    ? (await tx.userMembership.updateMany({
      where: { id: purchase.previousMembershipId, userId: purchase.userId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    })).count === 1
    : false;
  const now = new Date();
  const days = DURATION_DAYS[purchase.plan.duration] ?? 30;
  const membership = await tx.userMembership.create({
    data: {
      userId: purchase.userId, planId: purchase.planId, organizationId: purchase.organizationId, status: "ACTIVE",
      startDate: now, endDate: new Date(now.getTime() + days * 24 * 60 * 60 * 1000), pricePaid: purchase.amount,
      razorpayOrderId: purchase.razorpayOrderId, razorpayPaymentId: paymentId,
      ...(replaced ? { previousMembershipId: purchase.previousMembershipId } : {}),
    },
    include: { plan: true },
  });
  await postEntries(tx, [{
    organizationId: purchase.organizationId, type: "MEMBERSHIP_SALE", amount: Number(purchase.amount),
    sourceType: "MEMBERSHIP", sourceId: paymentId, memo: `Membership sale · ${purchase.plan.name} · ${membership.id.slice(0, 8)}`,
  }]);
  return membership;
}

export type MembershipSettlement =
  | { membership: Prisma.UserMembershipGetPayload<{ include: { plan: true } }> }
  | { mismatch: string };

/**
 * Grants the membership a captured payment bought, exactly once (the app's verify and the webhook can both land
 * here). Null when the payment's Razorpay order is no membership purchase (of `userId`, when given).
 */
export async function settleMembershipPurchase(app: FastifyInstance, payment: RazorpayPayment, userId?: string): Promise<MembershipSettlement | null> {
  if (!payment.orderId) return null;
  const purchase = await app.prisma.membershipPurchase.findUnique({ where: { razorpayOrderId: payment.orderId }, include: { plan: true } });
  if (!purchase || (userId && purchase.userId !== userId)) return null;
  const mismatch = paymentMismatch(payment, { razorpayOrderId: purchase.razorpayOrderId, amountInPaise: Math.round(Number(purchase.amount) * 100) });
  if (mismatch) return { mismatch };

  const created = await app.prisma.$transaction(async (tx) => {
    const { count } = await tx.membershipPurchase.updateMany({
      where: { id: purchase.id, paidAt: null },
      data: { paidAt: new Date(), razorpayPaymentId: payment.id },
    });
    return count === 1 ? activate(tx, purchase, payment.id) : null;
  });
  if (created) {
    notifyMembershipWelcome(app.fcm, app.prisma, purchase.userId, created.plan.name, created.endDate);
    return { membership: created };
  }
  const membership = await app.prisma.userMembership.findFirstOrThrow({ where: { razorpayPaymentId: payment.id }, include: { plan: true } });
  return { membership };
}
