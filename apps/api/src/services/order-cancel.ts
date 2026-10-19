import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/index.js";
import { releaseFromUnstartedTrip } from "./delivery/trip-ops.js";
import { reoptimizeTrips } from "./delivery/plan-wave.js";
import { releaseStock } from "./stock.js";
import { broadcastOrderUpdate } from "./order-broadcast.js";
import { sendLoyaltyNotification, sendOrderStatusNotification } from "./notification.js";
import { formatINR, formatOrderRef, plural, type CancelledBy } from "./notify/copy.js";
import { notifyStaff } from "./notify/staff.js";
import { reopenReplacements } from "./returns/replacement.js";

type Tx = Prisma.TransactionClient;

export interface CancellableOrder {
  id: string;
  userId: string;
  storeId: string;
  status: string;
  deliveryTripId: string | null;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  walletAmountUsed: Prisma.Decimal | null;
  loyaltyPointsUsed: number | null;
  loyaltyPointsEarned: number | null;
  user?: { name: string | null } | null;
  /** Read before cancelling: an emptied trip is deleted with the cancel */
  deliveryTrip?: { riderId: string | null } | null;
}

export interface CancelRefunds {
  refundAmount: number;
  /** An online payment was returned (to the wallet), so the order's payment is REFUNDED */
  paymentRefunded: boolean;
  pointsReturned: number;
}

async function moveLoyalty(tx: Tx, order: CancellableOrder, organizationId: string, points: number, description: string) {
  const key = { userId_organizationId: { userId: order.userId, organizationId } };
  const balance = points > 0
    ? await tx.loyaltyBalance.upsert({
      where: key,
      create: { userId: order.userId, organizationId, points, totalEarned: 0 },
      update: { points: { increment: points }, totalRedeemed: { decrement: points } },
    })
    : await tx.loyaltyBalance.update({ where: key, data: { points: { increment: points }, totalEarned: { increment: points } } });
  await tx.loyaltyTransaction.create({
    data: { userId: order.userId, organizationId, orderId: order.id, type: "REVERSAL", points, balanceAfter: balance.points, description },
  });
}

/** Refunds what the customer paid to their wallet and reverses loyalty points; runs inside the cancel transaction */
export async function applyCancelRefunds(tx: Tx, order: CancellableOrder, opts: { reverseEarned: boolean }): Promise<CancelRefunds> {
  const ref = formatOrderRef(order.id);
  const paymentRefunded = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID";
  // Points come back as points below, so the wallet gets back only what was paid in money
  const refundAmount = paymentRefunded ? Number(order.totalAmount) - (order.loyaltyPointsUsed ?? 0) : Number(order.walletAmountUsed ?? 0);
  if (refundAmount > 0) {
    const user = await tx.user.update({ where: { id: order.userId }, data: { walletBalance: { increment: refundAmount } } });
    await tx.walletTransaction.create({
      data: {
        userId: order.userId, orderId: order.id, type: "CREDIT", amount: refundAmount,
        balanceAfter: Number(user.walletBalance), description: `Refund for cancelled order ${ref}`,
      },
    });
  }

  const used = order.loyaltyPointsUsed ?? 0;
  const earned = opts.reverseEarned ? order.loyaltyPointsEarned ?? 0 : 0;
  if (used > 0 || earned > 0) {
    const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId }, select: { organizationId: true } });
    if (used > 0) await moveLoyalty(tx, order, store.organizationId, used, `Reversal for cancelled order ${ref}`);
    if (earned > 0) await moveLoyalty(tx, order, store.organizationId, -earned, `Earned points reversed for cancelled order ${ref}`);
  }
  return { refundAmount, paymentRefunded, pointsReturned: used };
}

/** Tells the customer, the packers (when the customer or system cancelled) and the rider (when it was on a trip) */
export async function notifyOrderCancelled(
  app: FastifyInstance,
  order: CancellableOrder,
  ctx: { by: CancelledBy; reason?: string | null; refunds: CancelRefunds; actorId?: string },
) {
  const { refunds } = ctx;
  sendOrderStatusNotification(app.fcm, app.prisma, order.id, "CANCELLED", {
    cancelledBy: ctx.by, reason: ctx.reason, refund: { amount: refunds.refundAmount, to: "wallet" },
  });
  if (refunds.pointsReturned > 0) {
    sendLoyaltyNotification(app.fcm, app.prisma, order.userId, "REVERSAL", refunds.pointsReturned, `order ${formatOrderRef(order.id)} was cancelled`);
  }

  const ref = formatOrderRef(order.id);
  // Unpaid online orders were never shown to staff, so their expiry needs no staff alert
  if (ctx.by === "customer") {
    notifyStaff(app.fcm, app.prisma, order.storeId, { permissions: ["ORDERS_PROCESS"] }, {
      type: "STAFF_ORDER",
      title: "Order cancelled by customer",
      body: `${ref} · ${formatINR(Number(order.totalAmount))} · ${order.user?.name || "The customer"} cancelled. Stop packing.`,
      data: { screen: "manage-order", orderId: order.id },
    });
  }
  if (!order.deliveryTripId) return;
  const left = await app.prisma.order.count({ where: { deliveryTripId: order.deliveryTripId } });
  notifyStaff(app.fcm, app.prisma, order.storeId, { permissions: ["ORDERS_DISPATCH"], userIds: [order.deliveryTrip?.riderId], excludeUserId: ctx.actorId }, {
    type: "STAFF_DELIVERY",
    title: left === 0 ? "Trip cancelled" : "Stop removed from trip",
    body: left === 0 ? `Order ${ref} was cancelled and the trip has no stops left.` : `Order ${ref} was cancelled. The trip now has ${plural(left, "stop")}.`,
    data: { screen: "trip", tripId: order.deliveryTripId },
  });
}

/** Customer or system cancellation of a PENDING/CONFIRMED order: stock back, refunds, trip gap closed, everyone told */
export async function cancelOrder(app: FastifyInstance, orderId: string, ctx: { by: "customer" | "system"; note: string }) {
  const existing = await app.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, user: { select: { name: true } }, deliveryTrip: { select: { riderId: true } } } });
  await releaseStock(app.prisma, existing.items.map((i) => ({ storeProductId: i.storeProductId, quantity: i.quantity })));

  const { order, refunds } = await app.prisma.$transaction(async (tx) => {
    const refunds = await applyCancelRefunds(tx, existing, { reverseEarned: false });
    await reopenReplacements(tx, orderId);
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", ...(refunds.paymentRefunded ? { paymentStatus: "REFUNDED" } : {}) },
      include: { items: true },
    });
    await tx.orderStatusLog.create({ data: { orderId, status: "CANCELLED", note: ctx.note } });
    await releaseFromUnstartedTrip(tx, orderId);
    return { order, refunds };
  });

  broadcastOrderUpdate(app.prisma, orderId, "CANCELLED");
  if (existing.deliveryTripId) {
    reoptimizeTrips(app.prisma, [existing.deliveryTripId]).catch((err: unknown) => app.log.error(err, `Re-ordering trip ${existing.deliveryTripId} failed`));
  }
  await notifyOrderCancelled(app, existing, { by: ctx.by, refunds });
  return order;
}
