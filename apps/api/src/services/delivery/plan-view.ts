import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istDay } from "../ist-day.js";
import { storeRiders } from "../permissions.js";
import { suggestRiders } from "./planner.js";
import { deliverySettings, fleetCapacity, slotRoster, type DeliverySettings } from "./settings.js";
import { waveTripWhere, wavePoolWhere, type Wave } from "./plan-wave.js";
import { codDue, type CodOrder } from "./rider.js";
import { riderLocation } from "./live-location.js";

const STOP_SELECT = {
  id: true, status: true, deliverySequence: true, totalAmount: true, paymentMethod: true, paymentStatus: true,
  walletAmountUsed: true, loyaltyPointsUsed: true, codCollectedVia: true,
  deliveryAddress: true, deliveryPincode: true, deliveryLat: true, deliveryLng: true, createdAt: true,
  user: { select: { name: true, phone: true } },
  _count: { select: { items: true } },
  statusLogs: { where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  // A failed attempt brings the order back to the pool; dispatch should see why
  deliveryFailures: { orderBy: { createdAt: "desc" }, take: 1, select: { reason: true, note: true, createdAt: true } },
} as const;

/** What the rider took at the door, so dispatch can see cash vs UPI per stop */
const withCollected = <T extends CodOrder & { status: string; statusLogs: { createdAt: Date }[] }>({ statusLogs, ...o }: T) => ({
  ...o,
  amountCollected: o.status === "DELIVERED" ? codDue(o) : 0,
  deliveredAt: statusLogs[0]?.createdAt ?? null,
});

/** The rider's last shared position, only while the trip is on the road */
function livePosition(tripId: string, status: string) {
  const loc = status === "IN_PROGRESS" ? riderLocation(tripId) : undefined;
  return loc ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt } : null;
}

const PACKED = new Set(["READY", "OUT_FOR_DELIVERY", "DELIVERED"]);

/** Trips of a wave with their stops, packing progress and (for planned trips) a suggested rider */
async function waveTrips(prisma: PrismaClient, storeId: string, wave: Wave, roster: string[], settings: DeliverySettings) {
  const today = istDay();
  // Express trips have no slot date: show today's, plus any still running from earlier
  const expressWindow = wave.kind === "EXPRESS"
    ? { OR: [{ createdAt: { gte: today.start } }, { status: { in: ["PLANNED", "CREATED", "IN_PROGRESS"] as ("PLANNED" | "CREATED" | "IN_PROGRESS")[] } }] }
    : {};
  const trips = await prisma.deliveryTrip.findMany({
    where: { ...waveTripWhere(storeId, wave), ...expressWindow, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    include: { rider: { select: { id: true, name: true, phone: true } }, orders: { orderBy: { deliverySequence: "asc" }, select: STOP_SELECT } },
  });
  const load = new Map<string, number>();
  for (const t of trips) if (t.riderId) load.set(t.riderId, (load.get(t.riderId) ?? 0) + 1);
  const planned = trips.filter((t) => t.status === "PLANNED");
  const picks = suggestRiders(planned.length, roster, load, wave.kind === "SLOT" ? settings.maxTripsPerRider : Number.MAX_SAFE_INTEGER);
  const suggestion = new Map(planned.map((t, i) => [t.id, picks[i]]));
  return trips.map(({ orders, ...t }) => ({
    ...t,
    stops: orders.map(withCollected),
    live: livePosition(t.id, t.status),
    packed: orders.filter((o) => PACKED.has(o.status)).length,
    suggestedRiderId: suggestion.get(t.id) ?? null,
  }));
}

/** Orders a wave covers that no trip holds yet, as the board shows them */
async function wavePool(prisma: PrismaClient, storeId: string, wave: Wave) {
  // Beyond what planning takes: express orders still being packed, and orders sent out before riders were required,
  // so dispatch can see them and give them a rider
  const shown = wave.kind === "EXPRESS"
    ? ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const
    : ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;
  return prisma.order.findMany({ where: { ...wavePoolWhere(storeId, wave), status: { in: [...shown] } }, orderBy: { createdAt: "asc" }, select: STOP_SELECT })
    .then((rows) => rows.map(withCollected));
}

const cutoffAt = (dateKey: string, startTime: string, cutoffMinutes: number) =>
  new Date(new Date(`${dateKey}T${startTime}:00+05:30`).getTime() - cutoffMinutes * 60_000);

/** The delivery board for one store and IST day: every wave with its roster, capacity, unplanned orders and trips */
export async function deliveryPlan(prisma: PrismaClient, storeId: string, dateKey?: string) {
  const day = istDay(dateKey);
  const settings = await deliverySettings(prisma, storeId);
  const weekday = new Date(`${day.key}T12:00:00+05:30`).getUTCDay();
  const slots = await prisma.deliverySlot.findMany({ where: { storeId, dayOfWeek: weekday, isActive: true }, orderBy: { startTime: "asc" } });
  const riders = await storeRiders(prisma, storeId);

  const slotWaves = await Promise.all(slots.map(async (slot) => {
    const wave: Wave = { kind: "SLOT", slotId: slot.id, dateKey: day.key };
    const roster = await slotRoster(prisma, slot.id, day.key);
    const [trips, pool] = await Promise.all([waveTrips(prisma, storeId, wave, roster.map((r) => r.id), settings), wavePool(prisma, storeId, wave)]);
    const booked = pool.length + trips.reduce((n, t) => n + t.stops.length, 0);
    return {
      kind: "SLOT" as const, slotId: slot.id, label: `${slot.startTime}–${slot.endTime}`, startTime: slot.startTime, endTime: slot.endTime,
      cutoffAt: cutoffAt(day.key, slot.startTime, slot.cutoffMinutes), booked,
      capacity: Math.min(slot.maxOrders, fleetCapacity(roster.length, settings)), roster, pool, trips,
    };
  }));
  const express = day.isToday
    ? [{ kind: "EXPRESS" as const, slotId: null, label: "Express", pool: await wavePool(prisma, storeId, { kind: "EXPRESS" }), trips: await waveTrips(prisma, storeId, { kind: "EXPRESS" }, riders.map((r) => r.id), settings) }]
    : [];
  return { date: day.key, isToday: day.isToday, settings, riders, waves: [...express, ...slotWaves] };
}
