import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getDirectionsRoute } from "../../lib/geo.js";
import { istDay } from "../ist-day.js";
import { planTrips, type LatLng, type PlanStop } from "./planner.js";
import { dateColumn, deliverySettings, slotRoster } from "./settings.js";

/** A batch of deliveries planned together: one slot on one day, or the store's express orders */
export type Wave = { kind: "SLOT"; slotId: string; dateKey: string } | { kind: "EXPRESS" };

/** Slot waves plan everything booked that isn't on its way yet; express plans only packed orders */
const SLOT_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

/** Trips belonging to a wave, in any status */
export function waveTripWhere(storeId: string, wave: Wave): Prisma.DeliveryTripWhereInput {
  return wave.kind === "SLOT"
    ? { storeId, wave: "SLOT", deliverySlotId: wave.slotId, slotDate: dateColumn(wave.dateKey) }
    : { storeId, wave: "EXPRESS" };
}

/** Orders the wave covers that aren't on a rider's trip; PLANNED trips are released before re-planning */
export function wavePoolWhere(storeId: string, wave: Wave): Prisma.OrderWhereInput {
  if (wave.kind === "EXPRESS") {
    return { storeId, fulfillmentType: "DELIVERY", deliverySlotId: null, status: "READY", deliveryTripId: null };
  }
  const day = istDay(wave.dateKey);
  return {
    storeId, fulfillmentType: "DELIVERY", deliverySlotId: wave.slotId, deliveryTripId: null,
    status: { in: [...SLOT_STATUSES] }, scheduledDate: { gte: day.start, lte: day.end },
  };
}

const toStop = (o: { id: string; deliveryLat: number | null; deliveryLng: number | null; deliveryPincode: string | null; deliveryAddress: string | null }): PlanStop =>
  ({ id: o.id, lat: o.deliveryLat, lng: o.deliveryLng, pincode: o.deliveryPincode, address: o.deliveryAddress });

/** How many trips and orders per trip this wave may use */
async function waveLimits(prisma: PrismaClient, storeId: string, wave: Wave, poolSize: number) {
  const settings = await deliverySettings(prisma, storeId);
  if (wave.kind === "EXPRESS") return { maxPerTrip: settings.expressBatchSize, maxTrips: Math.ceil(poolSize / settings.expressBatchSize) };
  const roster = await slotRoster(prisma, wave.slotId, wave.dateKey);
  const committed = await prisma.deliveryTrip.count({ where: { ...waveTripWhere(storeId, wave), status: { in: ["CREATED", "IN_PROGRESS", "COMPLETED"] } } });
  return { maxPerTrip: settings.maxOrdersPerTrip, maxTrips: Math.max(0, roster.length * settings.maxTripsPerRider - committed) };
}

/**
 * Plans the wave's unplanned orders into trips. By default its PLANNED trips are released and re-planned too;
 * `keepPlanned` adds trips for new orders only (express batching), so a manager's adjustments survive.
 * Assigned and started trips are never touched.
 */
export async function planWave(prisma: PrismaClient, storeId: string, wave: Wave, { keepPlanned = false } = {}) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { organizationId: true, latitude: true, longitude: true } });
  const origin: LatLng = { lat: store.latitude ?? 0, lng: store.longitude ?? 0 };

  const created = await prisma.$transaction(async (tx) => {
    const stale = keepPlanned ? [] : await tx.deliveryTrip.findMany({ where: { ...waveTripWhere(storeId, wave), status: "PLANNED" }, select: { id: true } });
    const staleIds = stale.map((t) => t.id);
    await tx.order.updateMany({ where: { deliveryTripId: { in: staleIds } }, data: { deliveryTripId: null, deliverySequence: null } });
    await tx.deliveryTrip.deleteMany({ where: { id: { in: staleIds } } });

    const pool = await tx.order.findMany({ where: wavePoolWhere(storeId, wave), orderBy: { createdAt: "asc" } });
    const limits = await waveLimits(prisma, storeId, wave, pool.length);
    const plan = planTrips(pool.map(toStop), origin, limits);
    const ids: string[] = [];
    for (const group of plan.groups) {
      const trip = await tx.deliveryTrip.create({
        data: {
          storeId, organizationId: store.organizationId, status: "PLANNED", wave: wave.kind, areaLabel: group.areaLabel,
          ...(wave.kind === "SLOT" ? { deliverySlotId: wave.slotId, slotDate: dateColumn(wave.dateKey) } : {}),
        },
      });
      for (const [i, stop] of group.stops.entries()) {
        await tx.order.update({ where: { id: stop.id }, data: { deliveryTripId: trip.id, deliverySequence: i + 1 } });
      }
      ids.push(trip.id);
    }
    return { tripIds: ids, overflow: plan.overflow.length };
  });

  for (const id of created.tripIds) await optimizeTrip(prisma, id, origin);
  return created;
}

/** Lets Google order a trip's located stops for the shortest round trip, and records its distance and time */
export async function optimizeTrip(prisma: PrismaClient, tripId: string, origin: LatLng) {
  const orders = await prisma.order.findMany({ where: { deliveryTripId: tripId }, orderBy: { deliverySequence: "asc" }, select: { id: true, deliveryLat: true, deliveryLng: true } });
  const located = orders.filter((o) => o.deliveryLat !== null && o.deliveryLng !== null);
  if (located.length === 0 || (origin.lat === 0 && origin.lng === 0)) return;
  const route = await getDirectionsRoute(origin, origin, located.map((o) => ({ lat: o.deliveryLat as number, lng: o.deliveryLng as number })), located.length > 1);
  if (!route) return;
  const visit = route.waypointOrder?.length === located.length ? route.waypointOrder.map((i) => located[i]) : located;
  // Unlocated stops keep their pincode order after the routed ones
  const sequence = [...visit, ...orders.filter((o) => !located.includes(o))];
  await prisma.$transaction([
    ...sequence.map((o, i) => prisma.order.update({ where: { id: o.id }, data: { deliverySequence: i + 1 } })),
    prisma.deliveryTrip.update({ where: { id: tripId }, data: { plannedDistanceM: route.totalDistanceMeters, plannedDurationS: route.totalDurationSeconds } }),
  ]);
}

/**
 * Re-orders trips by road after their stops changed (a move, a send-out, a cancellation). Trips already
 * delivering are left alone so the rider's order never shuffles mid-route; one that just left can still be fixed.
 */
export async function reoptimizeTrips(prisma: PrismaClient, tripIds: string[]) {
  const trips = await prisma.deliveryTrip.findMany({
    where: { id: { in: [...new Set(tripIds)] }, status: { in: ["PLANNED", "CREATED", "IN_PROGRESS"] }, orders: { none: { status: "DELIVERED" } } },
    select: { id: true, store: { select: { latitude: true, longitude: true } } },
  });
  for (const t of trips) {
    if (t.store.latitude == null || t.store.longitude == null) continue;
    await optimizeTrip(prisma, t.id, { lat: t.store.latitude, lng: t.store.longitude });
  }
}
