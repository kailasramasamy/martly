import type { Messaging } from "firebase-admin/messaging";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";
import { DELIVERY_FAILURE_LABELS, type DeliveryFailureReason } from "@martly/shared/constants";
import { startTripInTx } from "../delivery-trips.js";
import { broadcastToTripSubscribers } from "../ws-manager.js";
import { forgetTrip, invalidateRoute } from "./live-location.js";
import { notifyTripCompleted, type TripAssignment } from "../notify/delivery-alerts.js";
import { reoptimizeTrips, waveTripWhere, type Wave } from "./plan-wave.js";

type Tx = Prisma.TransactionClient;

export class TripOpError extends Error {}

/** The wave an order belongs to: its slot on its scheduled day, or express */
export function orderWave(order: { deliverySlotId: string | null; scheduledDate: Date | null }): Wave {
  return order.deliverySlotId && order.scheduledDate
    ? { kind: "SLOT", slotId: order.deliverySlotId, dateKey: istDateKey(order.scheduledDate) }
    : { kind: "EXPRESS" };
}

/** Deletes PLANNED trips left with no stops after orders were taken off them */
async function dropEmptyPlanned(tx: Tx, tripIds: string[]) {
  if (tripIds.length === 0) return;
  await tx.deliveryTrip.deleteMany({ where: { id: { in: tripIds }, status: "PLANNED", orders: { none: {} } } });
}

/** A cancelled order leaves its trip if that trip hasn't started; a trip left empty is dropped (planned) or cancelled (assigned) */
export async function releaseFromUnstartedTrip(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { deliveryTripId: true, deliveryTrip: { select: { status: true } } } });
  const tripId = order?.deliveryTripId;
  if (!tripId || (order.deliveryTrip?.status !== "PLANNED" && order.deliveryTrip?.status !== "CREATED")) return;
  await tx.order.update({ where: { id: orderId }, data: { deliveryTripId: null, deliverySequence: null } });
  await dropEmptyPlanned(tx, [tripId]);
  await tx.deliveryTrip.updateMany({ where: { id: tripId, status: "CREATED", orders: { none: {} } }, data: { status: "CANCELLED" } });
}

/** Puts orders on the rider's unstarted trip for their wave (creating one if needed), pulling them off any PLANNED trip */
export async function attachToRiderTrip(tx: Tx, args: { storeId: string; organizationId: string; riderId: string; orderIds: string[]; wave: Wave }) {
  const { storeId, organizationId, riderId, orderIds, wave } = args;
  const open = await tx.deliveryTrip.findFirst({ where: { ...waveTripWhere(storeId, wave), riderId, status: "CREATED" }, orderBy: { createdAt: "desc" } });
  const trip = open ?? await tx.deliveryTrip.create({
    data: {
      storeId, organizationId, riderId, status: "CREATED", wave: wave.kind,
      ...(wave.kind === "SLOT" ? { deliverySlotId: wave.slotId, slotDate: new Date(`${wave.dateKey}T00:00:00Z`) } : {}),
    },
  });
  const previous = await tx.order.findMany({ where: { id: { in: orderIds } }, select: { deliveryTripId: true } });
  const last = await tx.order.aggregate({ where: { deliveryTripId: trip.id }, _max: { deliverySequence: true } });
  for (const [i, id] of orderIds.entries()) {
    await tx.order.update({ where: { id }, data: { deliveryTripId: trip.id, deliverySequence: (last._max.deliverySequence ?? 0) + i + 1 } });
  }
  await dropEmptyPlanned(tx, previous.map((o) => o.deliveryTripId).filter((t): t is string => !!t && t !== trip.id));
  return { tripId: trip.id, created: !open };
}

interface SendArgs {
  storeId: string;
  organizationId: string;
  rider: { id: string; name: string };
  orderIds: string[];
  wave: Wave;
  /** Start the trip now, sending its orders out */
  start: boolean;
}

/** Gives orders to a rider (joining their unstarted trip) and optionally starts it; a blocked start rolls everything back */
export async function sendToRider(prisma: PrismaClient, { storeId, organizationId, rider, orderIds, wave, start }: SendArgs) {
  const sent = await prisma.$transaction(async (tx) => {
    const { tripId, created } = await attachToRiderTrip(tx, { storeId, organizationId, riderId: rider.id, orderIds, wave });
    const blocked = start ? await startProblem(tx, { id: tripId, riderId: rider.id, status: "CREATED" }) : null;
    if (blocked) throw new TripOpError(blocked);
    return { tripId, addedToExisting: !created, sentOut: start ? await startTripInTx(tx, tripId, rider.name) : [] };
  });
  // New stops join at the end; put the whole trip back in road order
  await reoptimizeTrips(prisma, [sent.tripId]);
  return sent;
}

/** Why a trip can't start yet: no rider, or orders still being packed */
export async function startProblem(tx: Tx | PrismaClient, trip: { id: string; riderId: string | null; status: string }) {
  if (!trip.riderId) return "Assign a rider before starting this trip";
  if (trip.status !== "CREATED") return `Cannot start trip in ${trip.status} status`;
  const orders = await tx.order.findMany({ where: { deliveryTripId: trip.id }, select: { status: true } });
  const unpacked = orders.filter((o) => o.status !== "READY" && o.status !== "OUT_FOR_DELIVERY").length;
  if (unpacked > 0) return `${unpacked} of ${orders.length} ${orders.length === 1 ? "order" : "orders"} ${unpacked === 1 ? "is" : "are"} still being packed`;
  return null;
}

/** Gives trips to riders: planned trips become assigned; an assigned trip that hasn't started can change hands */
export async function assignTrips(prisma: PrismaClient, storeId: string, riders: Set<string>, assignments: { tripId: string; riderId: string }[]): Promise<TripAssignment[]> {
  const trips = await prisma.deliveryTrip.findMany({ where: { id: { in: assignments.map((a) => a.tripId) } }, select: { id: true, storeId: true, status: true, riderId: true } });
  for (const a of assignments) {
    const trip = trips.find((t) => t.id === a.tripId);
    if (!trip || trip.storeId !== storeId) throw new TripOpError("Trip not found in this store");
    if (trip.status !== "PLANNED" && trip.status !== "CREATED") throw new TripOpError("Only trips that haven't started can be assigned");
    if (!riders.has(a.riderId)) throw new TripOpError("Rider is not assigned to this store");
  }
  await prisma.$transaction(assignments.map((a) => prisma.deliveryTrip.update({ where: { id: a.tripId }, data: { riderId: a.riderId, status: "CREATED" } })));
  return assignments.map((a) => ({ ...a, previousRiderId: trips.find((t) => t.id === a.tripId)?.riderId ?? null }));
}

/** Moves a stop between unstarted trips of the same store, or back to the unplanned pool */
export async function moveOrder(prisma: PrismaClient, fromTripId: string, orderId: string, toTripId: string | null) {
  const ids = [fromTripId, ...(toTripId ? [toTripId] : [])];
  const trips = await prisma.deliveryTrip.findMany({ where: { id: { in: ids } }, select: { id: true, storeId: true, status: true, riderId: true } });
  const from = trips.find((t) => t.id === fromTripId);
  const to = toTripId ? trips.find((t) => t.id === toTripId) : null;
  if (!from || (toTripId && !to)) throw new TripOpError("Trip not found");
  if ([from, to].some((t) => t && t.status !== "PLANNED" && t.status !== "CREATED")) throw new TripOpError("Stops can only move between trips that haven't started");
  if (to && to.storeId !== from.storeId) throw new TripOpError("Trips belong to different stores");
  const order = await prisma.order.findFirst({ where: { id: orderId, deliveryTripId: fromTripId } });
  if (!order) throw new TripOpError("This order isn't on that trip");

  await prisma.$transaction(async (tx) => {
    const last = to ? await tx.order.aggregate({ where: { deliveryTripId: to.id }, _max: { deliverySequence: true } }) : null;
    await tx.order.update({ where: { id: orderId }, data: { deliveryTripId: to?.id ?? null, deliverySequence: last ? (last._max.deliverySequence ?? 0) + 1 : null } });
    await dropEmptyPlanned(tx, [from.id]);
  });
  await reoptimizeTrips(prisma, [from.id, ...(to ? [to.id] : [])]);
  return { storeId: from.storeId, from: { tripId: from.id, riderId: from.riderId }, to: to ? { tripId: to.id, riderId: to.riderId } : null };
}

/** After a stop is delivered or given up on: the trip completes once nothing is left on the road, and live tracking refreshes */
export async function stopFinished(prisma: PrismaClient, fcm: Messaging | null, tripId: string) {
  const onTheRoad = await prisma.order.count({ where: { deliveryTripId: tripId, status: "OUT_FOR_DELIVERY" } });
  if (onTheRoad === 0) {
    const { count } = await prisma.deliveryTrip.updateMany({ where: { id: tripId, status: "IN_PROGRESS" }, data: { status: "COMPLETED", completedAt: new Date() } });
    forgetTrip(tripId);
    if (count > 0) await notifyTripCompleted(fcm, prisma, tripId);
  } else {
    invalidateRoute(tripId);
  }
  broadcastToTripSubscribers(tripId, { type: "trip:stop_completed", tripId });
}

interface FailArgs { tripId: string; orderId: string; riderId: string; reason: DeliveryFailureReason; note?: string }

/** The rider couldn't hand it over: the order goes back to the store as READY, off the trip, with the reason on record */
export async function failDelivery(prisma: PrismaClient, fcm: Messaging | null, { tripId, orderId, riderId, reason, note }: FailArgs) {
  const order = await prisma.order.findFirst({ where: { id: orderId, deliveryTripId: tripId }, select: { status: true } });
  if (!order) throw new TripOpError("This order isn't on that trip");
  if (order.status !== "OUT_FOR_DELIVERY") throw new TripOpError(`Order is ${order.status}, expected OUT_FOR_DELIVERY`);
  const label = DELIVERY_FAILURE_LABELS[reason];
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "READY", deliveryTripId: null, deliverySequence: null } }),
    prisma.orderStatusLog.create({ data: { orderId, status: "READY", note: `Delivery attempt failed: ${label}${note ? `. ${note}` : ""}` } }),
    prisma.deliveryFailure.create({ data: { orderId, tripId, riderId, reason, note } }),
  ]);
  await stopFinished(prisma, fcm, tripId);
}
