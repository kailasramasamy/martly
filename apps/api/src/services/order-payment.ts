import type { FastifyInstance } from "fastify";
import { createRazorpayOrder, ensureRazorpayCustomer } from "./payment.js";
import { sendOrderStatusNotification } from "./notification.js";
import { broadcastOrderUpdate } from "./order-broadcast.js";
import { notifyStaffOfNewOrder } from "./staff-alerts.js";

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/** Creates the Razorpay order for what the customer still owes (total less wallet) and remembers it on the order */
export async function prepareOrderPayment(app: FastifyInstance, orderId: string, userId: string) {
  const order = await app.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError("Order not found", 404);
  if (order.userId !== userId) throw httpError("Access denied", 403);
  if (order.paymentStatus === "PAID") throw httpError("Order is already paid", 400);

  const chargeAmount = Number(order.totalAmount) - Number(order.walletAmountUsed ?? 0);
  if (chargeAmount <= 0) throw httpError("Order is fully covered by wallet", 400);
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
  if (order.paymentStatus === "PAID") return order;

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
    sendOrderStatusNotification(app.fcm, app.prisma, order.id, order.userId, "CONFIRMED");
  }
  broadcastOrderUpdate(app.prisma, order.id, updated.status);
  notifyStaffOfNewOrder(app.fcm, app.prisma, order.id);
  return updated;
}
