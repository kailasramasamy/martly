import type { Messaging } from "firebase-admin/messaging";
import { DELIVERY_FAILURE_LABELS, Permission, type DeliveryFailureReason } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { haversine } from "../../lib/geo.js";
import { istDay } from "../ist-day.js";
import { sendNotification } from "../notification.js";
import { summarise } from "../delivery/rider.js";
import { riderLocation } from "../delivery/live-location.js";
import { alertOnce } from "./once.js";
import { formatINR, formatISTDate, formatOrderRef, plural } from "./copy.js";
import { notifyStaff } from "./staff.js";

const NEARBY_KM = 1;
const STALE_MS = 5 * 60_000;
const REALERT_MS = 30 * 60_000;
const FAILED_PICKUP_MS = 30 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tells one rider about their trip; the person who made the change already knows */
function alertRider(fcm: Messaging | null, prisma: PrismaClient, storeId: string, riderId: string, actorId: string | undefined, tripId: string, title: string, body: string) {
  return notifyStaff(fcm, prisma, storeId, { userIds: [riderId], excludeUserId: actorId }, {
    type: "STAFF_DELIVERY", title, body, data: { screen: "trip", tripId },
  });
}

async function tripLabel(prisma: PrismaClient, tripId: string) {
  const trip = await prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    select: { storeId: true, deliverySlot: { select: { startTime: true, endTime: true } }, _count: { select: { orders: true } } },
  });
  if (!trip) return null;
  const when = trip.deliverySlot ? `${trip.deliverySlot.startTime}–${trip.deliverySlot.endTime} slot` : "Express delivery";
  return { storeId: trip.storeId, stops: trip._count.orders, when };
}

/** Customers on a trip hear who is bringing their order, once per order and rider */
export async function notifyCustomersOfRider(fcm: Messaging | null, prisma: PrismaClient, orderIds: string[], rider: { id: string; name: string }) {
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, userId: true } });
  for (const o of orders) {
    if (!(await alertOnce(prisma, `rider:${o.id}:${rider.id}`))) continue;
    await sendNotification(fcm, prisma, {
      userId: o.userId, type: "DELIVERY_UPDATE", title: "Rider assigned",
      body: `${rider.name} will deliver order ${formatOrderRef(o.id)}.`, data: { screen: "order", orderId: o.id },
    });
  }
}

/** Orders were handed to a rider: a new trip, or extra stops on one they already had */
export async function notifyRiderSent(
  fcm: Messaging | null, prisma: PrismaClient,
  args: { tripId: string; rider: { id: string; name: string }; orderIds: string[]; sentOut: string[]; addedToExisting: boolean; actorId?: string },
) {
  const label = await tripLabel(prisma, args.tripId);
  if (!label) return;
  const title = args.addedToExisting ? `${plural(args.orderIds.length, "stop")} added` : `New trip · ${plural(label.stops, "stop")}`;
  await alertRider(fcm, prisma, label.storeId, args.rider.id, args.actorId, args.tripId, title, label.when);
  // Orders already on the road get "Out for delivery", which names the rider
  const waiting = args.orderIds.filter((id) => !args.sentOut.includes(id));
  await notifyCustomersOfRider(fcm, prisma, waiting, args.rider);
}

export interface TripAssignment { tripId: string; riderId: string; previousRiderId: string | null }

/** Assigned trips: the new rider gets the trip, a rider who lost it is told, customers learn the rider */
export async function notifyTripsAssigned(fcm: Messaging | null, prisma: PrismaClient, changes: TripAssignment[], actorId?: string) {
  for (const c of changes) {
    const label = await tripLabel(prisma, c.tripId);
    if (!label) continue;
    if (c.previousRiderId === c.riderId) continue;
    await alertRider(fcm, prisma, label.storeId, c.riderId, actorId, c.tripId, `New trip · ${plural(label.stops, "stop")}`, label.when);
    if (c.previousRiderId) await alertRider(fcm, prisma, label.storeId, c.previousRiderId, actorId, c.tripId, "Trip reassigned", `${label.when} was given to another rider.`);
    const [rider, orders] = await Promise.all([
      prisma.user.findUnique({ where: { id: c.riderId }, select: { name: true } }),
      prisma.order.findMany({ where: { deliveryTripId: c.tripId }, select: { id: true } }),
    ]);
    if (rider) await notifyCustomersOfRider(fcm, prisma, orders.map((o) => o.id), { id: c.riderId, name: rider.name });
  }
}

/** A trip with a rider was cancelled before it started */
export async function notifyTripCancelled(fcm: Messaging | null, prisma: PrismaClient, trip: { id: string; storeId: string; riderId: string | null; stops: number }, actorId?: string) {
  if (!trip.riderId) return;
  await alertRider(fcm, prisma, trip.storeId, trip.riderId, actorId, trip.id, "Trip cancelled", `${plural(trip.stops, "stop")} removed from your trip.`);
}

/** A stop moved between trips: each rider involved hears about it */
export async function notifyStopMoved(
  fcm: Messaging | null, prisma: PrismaClient,
  args: { storeId: string; orderId: string; from: { tripId: string; riderId: string | null }; to: { tripId: string; riderId: string | null } | null; actorId?: string },
) {
  const ref = formatOrderRef(args.orderId);
  if (args.from.riderId) await alertRider(fcm, prisma, args.storeId, args.from.riderId, args.actorId, args.from.tripId, "Stop removed", `Order ${ref} was taken off your trip.`);
  if (!args.to?.riderId) return;
  await alertRider(fcm, prisma, args.storeId, args.to.riderId, args.actorId, args.to.tripId, "1 stop added", `Order ${ref} was added to your trip.`);
  const rider = await prisma.user.findUnique({ where: { id: args.to.riderId }, select: { name: true } });
  if (rider) await notifyCustomersOfRider(fcm, prisma, [args.orderId], { id: args.to.riderId, name: rider.name });
}

/** A delivery attempt failed: the customer is told, dispatchers see the reason */
export async function notifyDeliveryFailed(fcm: Messaging | null, prisma: PrismaClient, orderId: string, reason: DeliveryFailureReason, actorId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, storeId: true } });
  if (!order) return;
  const ref = formatOrderRef(orderId);
  await sendNotification(fcm, prisma, {
    userId: order.userId, type: "DELIVERY_UPDATE", title: "Delivery attempt unsuccessful",
    body: `We couldn't deliver order ${ref}. The store will contact you to arrange another attempt.`, data: { screen: "order", orderId },
  });
  await notifyStaff(fcm, prisma, order.storeId, { permissions: [Permission.ORDERS_DISPATCH], excludeUserId: actorId }, {
    type: "STAFF_DELIVERY", title: `Delivery failed · ${ref}`, body: DELIVERY_FAILURE_LABELS[reason], data: { screen: "manage-order", orderId },
  });
}

/** Everything on the trip is delivered or given up on: dispatchers get the day's tally */
export async function notifyTripCompleted(fcm: Messaging | null, prisma: PrismaClient, tripId: string) {
  const trip = await prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    select: {
      storeId: true, status: true, rider: { select: { name: true } }, failures: { select: { id: true } },
      orders: { select: { status: true, paymentMethod: true, paymentStatus: true, totalAmount: true, walletAmountUsed: true, loyaltyPointsUsed: true, codCollectedVia: true } },
    },
  });
  if (!trip) return;
  const s = summarise([trip]);
  const cod = s.cashCollected > 0 ? ` · COD to collect ${formatINR(s.cashCollected)}` : "";
  await notifyStaff(fcm, prisma, trip.storeId, { permissions: [Permission.ORDERS_DISPATCH] }, {
    type: "STAFF_DELIVERY", title: `Trip complete · ${trip.rider?.name ?? "Rider"}`,
    body: `${s.delivered} delivered, ${s.failed} failed${cod}`, data: { screen: "trip", tripId },
  });
}

/** Called on each location ping: tells the next stop's customer when the rider is within a kilometre */
export async function notifyIfRiderNearby(fcm: Messaging | null, prisma: PrismaClient, tripId: string, lat: number, lng: number) {
  const next = await prisma.order.findFirst({
    where: { deliveryTripId: tripId, status: "OUT_FOR_DELIVERY" },
    orderBy: { deliverySequence: "asc" },
    select: { id: true, userId: true, deliveryLat: true, deliveryLng: true, deliveryTrip: { select: { rider: { select: { name: true } } } } },
  });
  if (!next || next.deliveryLat === null || next.deliveryLng === null) return;
  if (haversine(lat, lng, next.deliveryLat, next.deliveryLng) >= NEARBY_KM) return;
  if (!(await alertOnce(prisma, `nearby:${next.id}`))) return;
  await sendNotification(fcm, prisma, {
    userId: next.userId, type: "DELIVERY_UPDATE", title: "Your rider is nearby",
    body: `${next.deliveryTrip?.rider?.name ?? "Your rider"} is about to arrive with order ${formatOrderRef(next.id)}.`,
    data: { screen: "live-tracking", orderId: next.id },
  });
}

interface SlotWindow { dayOfWeek: number; startTime: string; endTime: string }

/** Open orders booked into a slot from today on; load before deleting a slot, which detaches them */
export function openSlotOrders(prisma: PrismaClient, slotId: string) {
  return prisma.order.findMany({
    where: { deliverySlotId: slotId, status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] }, scheduledDate: { gte: istDay().start } },
    select: { id: true, userId: true, scheduledDate: true },
  });
}

/** A slot's time changed or it was removed: customers with those orders are told */
export async function notifySlotChanged(fcm: Messaging | null, prisma: PrismaClient, orders: Awaited<ReturnType<typeof openSlotOrders>>, updated: SlotWindow | null) {
  for (const o of orders) {
    const ref = formatOrderRef(o.id);
    const day = o.scheduledDate ? ` on ${formatISTDate(o.scheduledDate)}` : "";
    const body = updated
      ? `Order ${ref}${day} will now be delivered between ${updated.startTime} and ${updated.endTime}.`
      : `The delivery slot for order ${ref}${day} is no longer available. The store will contact you.`;
    await sendNotification(fcm, prisma, { userId: o.userId, type: "DELIVERY_UPDATE", title: "Delivery time changed", body, data: { screen: "order", orderId: o.id } });
  }
}

const slotPeriod = (startTime: string) => {
  const hour = Number(startTime.split(":")[0]);
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
};

/** The auto-planner built a slot's trips: dispatchers need to assign riders */
export async function notifyWavePlanned(
  fcm: Messaging | null, prisma: PrismaClient,
  args: { storeId: string; slot: { id: string; startTime: string }; dateKey: string; tripIds: string[]; overflow: number },
) {
  if (!(await alertOnce(prisma, `planned:${args.slot.id}:${args.dateKey}`))) return;
  const over = args.overflow > 0 ? ` ${plural(args.overflow, "order")} over capacity.` : "";
  await notifyStaff(fcm, prisma, args.storeId, { permissions: [Permission.ORDERS_DISPATCH] }, {
    type: "STAFF_DELIVERY", title: `${slotPeriod(args.slot.startTime)} slot planned · ${plural(args.tripIds.length, "trip")}`,
    body: `Assign riders to start them.${over}`, data: { screen: "trip", ...(args.tripIds[0] ? { tripId: args.tripIds[0] } : {}) },
  });
}

/** Trips on the road whose rider has stopped reporting a location */
export async function alertStaleRiders(fcm: Messaging | null, prisma: PrismaClient) {
  const now = Date.now();
  const trips = await prisma.deliveryTrip.findMany({
    where: { status: "IN_PROGRESS", startedAt: { lt: new Date(now - STALE_MS) } },
    select: { id: true, storeId: true, rider: { select: { name: true } }, _count: { select: { orders: { where: { status: "OUT_FOR_DELIVERY" } } } } },
  });
  for (const trip of trips) {
    const loc = riderLocation(trip.id);
    if (loc && now - new Date(loc.updatedAt).getTime() <= STALE_MS) continue;
    if (trip._count.orders === 0) continue;
    if (!(await alertOnce(prisma, `stale:${trip.id}:${Math.floor(now / REALERT_MS)}`))) continue;
    await notifyStaff(fcm, prisma, trip.storeId, { permissions: [Permission.ORDERS_DISPATCH] }, {
      type: "STAFF_DELIVERY", title: `Rider offline · ${trip.rider?.name ?? "Rider"}`,
      body: `No location for 5 min, ${plural(trip._count.orders, "stop")} left`, data: { screen: "trip", tripId: trip.id },
    });
  }
}

/** Orders that failed delivery yesterday or today and are still waiting at the store with no trip: escalate to owners */
export async function alertUnclaimedFailures(fcm: Messaging | null, prisma: PrismaClient) {
  const now = Date.now();
  const failures = await prisma.deliveryFailure.findMany({
    where: {
      createdAt: { gte: new Date(now - DAY_MS), lt: new Date(now - FAILED_PICKUP_MS) },
      order: { status: "READY", deliveryTripId: null },
    },
    distinct: ["orderId"],
    select: { orderId: true, order: { select: { storeId: true } } },
  });
  for (const f of failures) {
    if (!(await alertOnce(prisma, `failesc:${f.orderId}`))) continue;
    await notifyStaff(fcm, prisma, f.order.storeId, { permissions: [Permission.ORDERS_DISPATCH], escalation: true }, {
      type: "STAFF_DELIVERY", title: `Failed delivery waiting · ${formatOrderRef(f.orderId)}`,
      body: "Back at the store for over 30 min with no new trip.", data: { screen: "manage-order", orderId: f.orderId },
    });
  }
}

