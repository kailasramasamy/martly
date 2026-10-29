import type { FastifyInstance } from "fastify";
import { UNPAID_EXPIRY_MINUTES } from "@martly/shared/order-flow";
import { slotCapacity } from "../delivery/settings.js";
import { istDateKey, istDay } from "../ist-day.js";
import { cancelOrder } from "../order-cancel.js";
import { sendNotification } from "../notification.js";
import { formatINR, formatISTDate, formatOrderRef, plural } from "./copy.js";
import { alertOnce } from "./once.js";
import { notifyStaff } from "./staff.js";

const MINUTE_MS = 60_000;
const SCAN_WINDOW_MS = 24 * 60 * MINUTE_MS;
// Slow-order alerts are for live operations; anything older is stale, not urgent
const SLA_WINDOW_MS = 6 * 60 * MINUTE_MS;
const DISPATCH_WAIT_MINUTES = 20;
const SLOW_THRESHOLDS = { PENDING: 10, CONFIRMED: 20, PREPARING: 30 } as const;

type SlowStatus = keyof typeof SLOW_THRESHOLDS;
// Scheduled orders are packed close to their slot, so packing deadlines start this long before it
const PACK_LEAD_MINUTES = 60;

function slotStartMs(order: { scheduledDate: Date | null; slotStartTime: string | null }): number {
  if (!order.scheduledDate || !order.slotStartTime) return 0;
  return new Date(`${istDateKey(order.scheduledDate)}T${order.slotStartTime}:00+05:30`).getTime();
}

function logFailure(app: FastifyInstance, what: string) {
  return (err: unknown) => app.log.error(err, `${what} failed`);
}

async function placedAck(app: FastifyInstance, orderId: string) {
  const order = await app.prisma.order.findUnique({ where: { id: orderId }, include: { store: { select: { name: true } } } });
  if (!order) return;
  const ref = formatOrderRef(order.id);
  const body = order.status === "CONFIRMED"
    ? `We've received order ${ref} of ${formatINR(order.totalAmount)}. ${order.store.name} will start packing it shortly.`
    : `We've received order ${ref} of ${formatINR(order.totalAmount)}. ${order.store.name} will confirm it shortly.`;
  await sendNotification(app.fcm, app.prisma, {
    userId: order.userId, type: "ORDER_CONFIRMED", title: "Order placed", body, data: { screen: "order", orderId: order.id },
  });
}

/** Acknowledges an order that skips online payment (COD or fully wallet-paid) */
export function notifyOrderPlaced(app: FastifyInstance, orderId: string) {
  placedAck(app, orderId).catch(logFailure(app, "Order placed notification"));
}

async function paymentFailed(app: FastifyInstance, orderId: string, paymentId: string) {
  if (!(await alertOnce(app.prisma, `payfail:${paymentId}`))) return;
  const order = await app.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true } });
  if (!order) return;
  await sendNotification(app.fcm, app.prisma, {
    userId: order.userId, type: "PAYMENT", title: "Payment failed",
    body: `Payment for order ${formatOrderRef(order.id)} didn't go through. Tap to retry or pay another way.`,
    data: { screen: "order", orderId: order.id },
  });
}

/** Tells the customer a payment attempt failed; verify and webhook can both report the same payment */
export function notifyPaymentFailed(app: FastifyInstance, orderId: string, paymentId: string) {
  paymentFailed(app, orderId, paymentId).catch(logFailure(app, "Payment failed notification"));
}

/** Marks an unpaid, open order's payment as failed; a paid, refunded or cancelled order is left as it is */
export async function markPaymentFailed(app: FastifyInstance, orderId: string, paymentId: string) {
  const { count } = await app.prisma.order.updateMany({
    where: { id: orderId, status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "FAILED"] } },
    data: { paymentStatus: "FAILED" },
  });
  if (count > 0) notifyPaymentFailed(app, orderId, paymentId);
}

async function slotFull(app: FastifyInstance, slotId: string, dateKey: string) {
  const slot = await app.prisma.deliverySlot.findUnique({ where: { id: slotId } });
  if (!slot) return;
  const { start, end } = istDay(dateKey);
  const booked = await app.prisma.order.count({
    where: { deliverySlotId: slotId, scheduledDate: { gte: start, lte: end }, status: { not: "CANCELLED" } },
  });
  const capacity = await slotCapacity(app.prisma, slot, dateKey);
  if (booked < capacity || !(await alertOnce(app.prisma, `slotfull:${slotId}:${dateKey}`))) return;
  await notifyStaff(app.fcm, app.prisma, slot.storeId, { permissions: ["DELIVERY_CONFIG", "ORDERS_DISPATCH"] }, {
    type: "STAFF_DELIVERY",
    title: "Delivery slot is full",
    body: `${slot.startTime}–${slot.endTime} on ${formatISTDate(start)} is full (${booked}/${capacity}). Add riders or raise the limit.`,
    data: { screen: "delivery-slots", slotId },
  });
}

/** Alerts the delivery team once when a booking fills a slot's capacity for a day */
export function notifySlotFullIfNeeded(app: FastifyInstance, slotId: string, dateKey: string) {
  slotFull(app, slotId, dateKey).catch(logFailure(app, "Slot full alert"));
}

async function expireUnpaidOrders(app: FastifyInstance, now: number) {
  const stale = await app.prisma.order.findMany({
    where: {
      status: "PENDING", paymentMethod: "ONLINE", paymentStatus: { in: ["PENDING", "FAILED"] }, isSubscriptionOrder: false,
      createdAt: { gte: new Date(now - SCAN_WINDOW_MS), lte: new Date(now - UNPAID_EXPIRY_MINUTES * MINUTE_MS) },
    },
    select: { id: true },
  });
  for (const { id } of stale) {
    // Only while still unpaid: a payment that lands in between keeps the order
    await cancelOrder(app, id, {
      by: "system", note: `Payment not completed in ${UNPAID_EXPIRY_MINUTES} minutes`,
      allowed: { statuses: ["PENDING"], paymentStatuses: ["PENDING", "FAILED"] },
    }).catch((err: { statusCode?: number }) => {
      if (err.statusCode !== 409) throw err;
    });
  }
}

const SLOW_LABEL: Record<SlowStatus, string> = { PENDING: "waiting to be accepted", CONFIRMED: "waiting to be packed", PREPARING: "still being packed" };

async function alertSlowOrders(app: FastifyInstance, now: number) {
  const orders = await app.prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED", "PREPARING"] }, createdAt: { gte: new Date(now - SLA_WINDOW_MS) },
      OR: [{ paymentMethod: { not: "ONLINE" } }, { paymentStatus: "PAID" }],
    },
    select: {
      id: true, storeId: true, status: true, totalAmount: true, createdAt: true, scheduledDate: true, slotStartTime: true,
      statusLogs: { select: { status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  for (const order of orders) {
    const status = order.status as SlowStatus;
    const packFrom = slotStartMs(order) - PACK_LEAD_MINUTES * MINUTE_MS;
    if (status !== "PENDING" && packFrom > now) continue;
    const loggedAt = order.statusLogs.find((l) => l.status === status)?.createdAt ?? order.createdAt;
    const since = status !== "PENDING" && packFrom > loggedAt.getTime() ? new Date(packFrom) : loggedAt;
    const waited = Math.floor((now - since.getTime()) / MINUTE_MS);
    const threshold = SLOW_THRESHOLDS[status];
    for (const stage of [2, 1]) {
      if (waited < threshold * stage) continue;
      if (await alertOnce(app.prisma, `sla:${order.id}:${status}:${stage}`)) {
        await notifyStaff(app.fcm, app.prisma, order.storeId, { permissions: ["ORDERS_PROCESS"], escalation: stage === 2 }, {
          type: "STAFF_ORDER",
          title: `Order ${SLOW_LABEL[status]}`,
          body: `Order waiting ${waited} min · ${formatOrderRef(order.id)} · ${formatINR(order.totalAmount)}`,
          data: { screen: "manage-order", orderId: order.id },
        });
      }
      break;
    }
  }
}

async function alertUndispatched(app: FastifyInstance, now: number) {
  const ready = await app.prisma.order.findMany({
    where: { status: "READY", fulfillmentType: "DELIVERY", deliveryTripId: null, createdAt: { gte: new Date(now - SLA_WINDOW_MS) } },
    select: { id: true, storeId: true, totalAmount: true, scheduledDate: true, slotStartTime: true, statusLogs: { where: { status: "READY" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const fresh = new Map<string, number>();
  for (const order of ready) {
    if (slotStartMs(order) > now) continue;
    if (await alertOnce(app.prisma, `dispatch:${order.id}`)) fresh.set(order.storeId, (fresh.get(order.storeId) ?? 0) + 1);

    const readyAt = Math.max(order.statusLogs[0]?.createdAt.getTime() ?? now, slotStartMs(order));
    const waited = Math.floor((now - readyAt) / MINUTE_MS);
    if (waited >= DISPATCH_WAIT_MINUTES && (await alertOnce(app.prisma, `sla:${order.id}:READY:1`))) {
      await notifyStaff(app.fcm, app.prisma, order.storeId, { permissions: ["ORDERS_DISPATCH"] }, {
        type: "STAFF_ORDER",
        title: "Packed order not dispatched",
        body: `Order waiting ${waited} min · ${formatOrderRef(order.id)} · ${formatINR(order.totalAmount)}`,
        data: { screen: "manage-order", orderId: order.id },
      });
    }
  }
  for (const [storeId, count] of fresh) {
    await notifyStaff(app.fcm, app.prisma, storeId, { permissions: ["ORDERS_DISPATCH"] }, {
      type: "STAFF_DELIVERY",
      title: `${plural(count, "order")} ready for dispatch`,
      body: `${plural(count, "order")} packed with no trip yet. Plan a trip to get ${count === 1 ? "it" : "them"} out.`,
      data: { screen: "trip" },
    });
  }
}

/** One scheduler tick: expire unpaid online orders and nudge staff about orders stuck in a status */
export async function runOrderSlaChecks(app: FastifyInstance) {
  const now = Date.now();
  await expireUnpaidOrders(app, now);
  await alertSlowOrders(app, now);
  await alertUndispatched(app, now);
}
