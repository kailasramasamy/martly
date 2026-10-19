import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { Messaging } from "firebase-admin/messaging";
import { broadcastOrderUpdate } from "./order-broadcast.js";
import { sendOrderStatusNotification } from "./notification.js";

interface TripOrderCheck {
  id: string;
  status: string;
  storeId: string;
  fulfillmentType: string;
  deliveryTripId: string | null;
  /** Status of the trip it's on; a PLANNED trip doesn't hold it, so it can still be given to a rider */
  deliveryTrip: { status: string } | null;
}

/** Why these orders can't go on a new trip, or null. Starting straight away also takes orders already out with no rider. */
export function tripOrderProblem(orders: TripOrderCheck[], orderIds: string[], storeId: string, start: boolean): string | null {
  const found = new Set(orders.map((o) => o.id));
  const missing = orderIds.filter((id) => !found.has(id));
  if (missing.length) return `Orders not found: ${missing.map((id) => id.slice(0, 8)).join(", ")}`;

  for (const order of orders) {
    const ref = `Order ${order.id.slice(0, 8)}`;
    if (order.storeId !== storeId) return `${ref} does not belong to this store`;
    if (order.fulfillmentType !== "DELIVERY") return `${ref} is a pickup order`;
    if (order.deliveryTrip && order.deliveryTrip.status !== "PLANNED") return `${ref} is already assigned to a trip`;
    const sendable = order.status === "READY" || (start && order.status === "OUT_FOR_DELIVERY");
    if (!sendable) return `${ref} is ${order.status}, expected READY`;
  }
  return null;
}

/** Puts a trip on the road: IN_PROGRESS, and its READY orders out for delivery. Returns the orders moved. */
export async function startTripInTx(tx: Prisma.TransactionClient, tripId: string, riderName: string): Promise<string[]> {
  await tx.deliveryTrip.update({ where: { id: tripId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  const ready = await tx.order.findMany({ where: { deliveryTripId: tripId, status: "READY" }, select: { id: true } });
  for (const { id } of ready) {
    await tx.order.update({ where: { id }, data: { status: "OUT_FOR_DELIVERY" } });
    await tx.orderStatusLog.create({ data: { orderId: id, status: "OUT_FOR_DELIVERY", note: `Out with ${riderName}` } });
  }
  return ready.map((o) => o.id);
}

/** Tells open screens and each customer (push and in-app) that their order is on its way */
export async function broadcastOutForDelivery(fcm: Messaging | null, prisma: PrismaClient, orderIds: string[]) {
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, userId: true } });
  for (const o of orders) {
    broadcastOrderUpdate(prisma, o.id, "OUT_FOR_DELIVERY");
    sendOrderStatusNotification(fcm, prisma, o.id, "OUT_FOR_DELIVERY");
  }
}
