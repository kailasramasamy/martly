import type { FastifyInstance } from "fastify";
import { createRazorpayOrder, ensureRazorpayCustomer, refundRazorpayPayment } from "./payment.js";
import { sendNotification, sendOrderStatusNotification } from "./notification.js";
import { formatINR, formatOrderRef } from "./notify/copy.js";
import { notifyStaff } from "./notify/staff.js";
import { broadcastOrderUpdate } from "./order-broadcast.js";
import { notifyStaffOfNewOrder } from "./staff-alerts.js";

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

type Payable = { totalAmount: { toNumber(): number }; walletAmountUsed: { toNumber(): number } | null; loyaltyPointsUsed: number | null };

/** What the customer pays online: the total less wallet and loyalty points already applied */
const onlineCharge = (order: Payable) =>
  order.totalAmount.toNumber() - (order.walletAmountUsed?.toNumber() ?? 0) - (order.loyaltyPointsUsed ?? 0);

/** Creates the Razorpay order for what the customer still owes (total less wallet and points) and remembers it on the order */
export async function prepareOrderPayment(app: FastifyInstance, orderId: string, userId: string) {
  const order = await app.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError("Order not found", 404);
  if (order.userId !== userId) throw httpError("Access denied", 403);
  if (order.paymentStatus === "PAID") throw httpError("Order is already paid", 400);

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
  await app.prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rpOrder.id } });
  return { order, rpOrderId: rpOrder.id, amountInPaise, customerId };
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
    sendOrderStatusNotification(app.fcm, app.prisma, order.id, "CONFIRMED");
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
