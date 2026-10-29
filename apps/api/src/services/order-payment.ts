import type { FastifyInstance } from "fastify";
import type { VerifyPaymentInput } from "@martly/shared/schemas";
import {
  createRazorpayOrder, ensureRazorpayCustomer, fetchPayment, findCapturedPayment, paymentMismatch, refundRazorpayPayment,
  verifyRazorpaySignature, type RazorpayPayment,
} from "./payment.js";
import { markPaymentFailed } from "./notify/order-alerts.js";
import { sendNotification, sendOrderStatusNotification } from "./notification.js";
import { formatINR, formatOrderRef } from "./notify/copy.js";
import { notifyStaff } from "./notify/staff.js";
import { broadcastOrderUpdate } from "./order-broadcast.js";
import { notifyStaffOfNewOrder } from "./staff-alerts.js";
import { onlineCharge } from "@martly/shared/order-flow";

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

type Payable = { totalAmount: { toNumber(): number }; walletAmountUsed: { toNumber(): number } | null; loyaltyPointsUsed: number | null };


/**
 * Creates the Razorpay order for what the customer still owes (total less wallet and points). Each one is kept as an
 * attempt, so a payment on an earlier attempt (UPI, then back, then card) still settles the order.
 */
export async function prepareOrderPayment(app: FastifyInstance, orderId: string, userId: string) {
  const order = await app.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError("Order not found", 404);
  if (order.userId !== userId) throw httpError("Access denied", 403);
  if (order.paymentStatus === "PAID") throw httpError("Order is already paid", 400);
  if (order.status === "CANCELLED") throw httpError("This order was cancelled because payment wasn't completed in time", 400);

  const chargeAmount = onlineCharge(order);
  if (chargeAmount <= 0) throw httpError("Order is fully covered by wallet and points", 400);
  const amountInPaise = Math.round(chargeAmount * 100);

  // Razorpay customer enables saved payment instruments; only a Razorpay refusal is tolerated
  let customerId: string | undefined;
  try {
    customerId = await ensureRazorpayCustomer(app.prisma, userId);
  } catch (err) {
    if (typeof (err as { statusCode?: unknown })?.statusCode !== "number") throw err;
  }

  const rpOrder = await createRazorpayOrder(amountInPaise, order.id, customerId);
  await app.prisma.$transaction([
    app.prisma.paymentAttempt.create({ data: { orderId: order.id, razorpayOrderId: rpOrder.id, amount: amountInPaise } }),
    app.prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rpOrder.id } }),
  ]);
  return { order, rpOrderId: rpOrder.id, amountInPaise, customerId };
}

/** The attempt a Razorpay order belongs to; an order prepared before attempts were recorded still carries its id */
async function findAttempt(app: FastifyInstance, razorpayOrderId: string) {
  const attempt = await app.prisma.paymentAttempt.findUnique({ where: { razorpayOrderId } });
  if (attempt) return attempt;
  const order = await app.prisma.order.findFirst({ where: { razorpayOrderId } });
  return order && { orderId: order.id, razorpayOrderId, amount: Math.round(onlineCharge(order) * 100) };
}

export type AttemptSettlement = { order: Awaited<ReturnType<typeof settleOrderPayment>> } | { mismatch: string };

/**
 * Settles the order a Razorpay payment was made for, found through the attempt its Razorpay order belongs to. Null
 * when that Razorpay order is no attempt (of `orderId`, when given); a mismatch when it didn't pay the attempt in full.
 */
export async function settleAttemptPayment(app: FastifyInstance, payment: RazorpayPayment, orderId?: string): Promise<AttemptSettlement | null> {
  if (!payment.orderId) return null;
  const attempt = await findAttempt(app, payment.orderId);
  if (!attempt || (orderId && attempt.orderId !== orderId)) return null;
  const mismatch = paymentMismatch(payment, { razorpayOrderId: attempt.razorpayOrderId, amountInPaise: attempt.amount });
  if (mismatch) return { mismatch };
  return { order: await settleOrderPayment(app, attempt.orderId, payment.id) };
}

/**
 * The app's checkout verify. The signed Razorpay order must be one of this order's attempts, and Razorpay must say the
 * payment captured that attempt's full amount, so a payment made for anything else can't mark this order paid.
 */
export async function verifyOrderPayment(app: FastifyInstance, orderId: string, body: VerifyPaymentInput) {
  const attempt = await findAttempt(app, body.razorpay_order_id);
  if (!attempt || attempt.orderId !== orderId) throw httpError("Payment does not belong to this order", 400);
  if (!verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    await markPaymentFailed(app, orderId, body.razorpay_payment_id);
    throw httpError("Payment verification failed", 400);
  }
  const settled = await settleAttemptPayment(app, await fetchPayment(body.razorpay_payment_id), orderId);
  if (!settled) throw httpError("Payment does not belong to this order", 400);
  if ("mismatch" in settled) throw httpError(settled.mismatch, 400);
  return settled.order;
}

/** Status poll for UPI intent: settles the order from a captured payment on any of its recent attempts */
export async function pollOrderPayment(app: FastifyInstance, orderId: string): Promise<string | null> {
  const attempts = await app.prisma.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: "desc" }, take: 5 });
  for (const attempt of attempts) {
    const payment = await findCapturedPayment(attempt.razorpayOrderId);
    const settled = payment && await settleAttemptPayment(app, payment, orderId);
    if (settled && "order" in settled) return settled.order.paymentStatus;
  }
  return null;
}

/** Marks an order paid and auto-confirms it; safe to call repeatedly (checkout verify, status poll and webhook race) */
export async function settleOrderPayment(app: FastifyInstance, orderId: string, paymentId: string) {
  const order = await app.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") return order;
  if (order.status === "CANCELLED") return refundLatePayment(app, order, paymentId);

  const updated = await app.prisma.$transaction(async (tx) => {
    // Conditional update so a concurrent verify/poll/webhook settles the order only once
    const { count } = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "PAID" } },
      data: {
        paymentStatus: "PAID",
        razorpayPaymentId: paymentId,
        // Auto-confirm on successful payment
        ...(order.status === "PENDING" ? { status: "CONFIRMED" } : {}),
      },
    });
    if (count === 0) return null;
    if (order.status === "PENDING") {
      await tx.orderStatusLog.create({
        data: { orderId: order.id, status: "CONFIRMED", note: "Payment verified" },
      });
    }
    await tx.user.update({ where: { id: order.userId }, data: { preferredPaymentMethod: "ONLINE" } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
  if (!updated) return app.prisma.order.findUniqueOrThrow({ where: { id: order.id } });

  if (order.status === "PENDING") {
    sendOrderStatusNotification(app.fcm, app.prisma, order.id, "CONFIRMED", { paidAmount: onlineCharge(order) });
  }
  broadcastOrderUpdate(app.prisma, order.id, updated.status);
  notifyStaffOfNewOrder(app.fcm, app.prisma, order.id);
  return updated;
}

type PaidOrder = Payable & { id: string; userId: string; storeId: string };

/**
 * Money arrived for an order that was already cancelled (customer paid in a stale checkout, or the
 * payment-expiry job won the race): record it, refund it to the source and tell the customer and owners.
 */
async function refundLatePayment(app: FastifyInstance, order: PaidOrder, paymentId: string) {
  const { count } = await app.prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { notIn: ["PAID", "REFUNDED"] } },
    data: { paymentStatus: "PAID", razorpayPaymentId: paymentId },
  });
  if (count === 0) return app.prisma.order.findUniqueOrThrow({ where: { id: order.id } });

  const ref = formatOrderRef(order.id);
  const amount = formatINR(onlineCharge(order));
  const refunded = await refundRazorpayPayment(paymentId).then(() => true, (err: unknown) => {
    app.log.error(err, `Refund of late payment ${paymentId} for cancelled order ${order.id} failed`);
    return false;
  });
  if (refunded) {
    await app.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });
    sendNotification(app.fcm, app.prisma, {
      userId: order.userId, type: "PAYMENT", title: "Payment refunded",
      body: `Order ${ref} was already cancelled, so your payment of ${amount} is being refunded to your original payment method.`,
      data: { screen: "order", orderId: order.id },
    });
  }
  notifyStaff(app.fcm, app.prisma, order.storeId, { permissions: ["FINANCE_MANAGE"], escalation: true }, {
    type: "STAFF_ORDER",
    title: refunded ? "Payment refunded on cancelled order" : "Refund needed on cancelled order",
    body: refunded
      ? `${amount} arrived for cancelled order ${ref} and was refunded automatically.`
      : `${amount} arrived for cancelled order ${ref}. The automatic refund failed — refund payment ${paymentId} in Razorpay.`,
    data: { screen: "manage-order", orderId: order.id },
  });
  return app.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}
