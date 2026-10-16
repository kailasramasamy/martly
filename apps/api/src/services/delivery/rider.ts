import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { amountDue } from "@martly/shared/order-flow";
import { istDay } from "../ist-day.js";
import { dateColumn } from "./settings.js";

const ACTIVE = ["CREATED", "IN_PROGRESS"] as ("CREATED" | "IN_PROGRESS")[];

/** Trips that belong to an IST day: slot trips by their slot date, express trips by when they were made, plus any still running today */
export function tripsOnDay(dateKey?: string): Prisma.DeliveryTripWhereInput {
  const day = istDay(dateKey);
  return {
    status: { notIn: ["PLANNED", "CANCELLED"] },
    OR: [
      { slotDate: dateColumn(day.key) },
      { slotDate: null, createdAt: { gte: day.start, lte: day.end } },
      ...(day.isToday ? [{ status: { in: ACTIVE } }] : []),
    ],
  };
}

const RIDER_TRIP_INCLUDE = {
  store: { select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true } },
  deliverySlot: { select: { startTime: true, endTime: true } },
  orders: {
    orderBy: { deliverySequence: "asc" },
    select: {
      id: true, status: true, deliverySequence: true, totalAmount: true, paymentMethod: true, paymentStatus: true,
      walletAmountUsed: true, loyaltyPointsUsed: true, codCollectedVia: true, deliveryAddress: true, deliveryPincode: true, deliveryLat: true, deliveryLng: true,
      deliveryNotes: true, slotStartTime: true, slotEndTime: true, estimatedDeliveryAt: true,
      user: { select: { name: true, phone: true } },
      statusLogs: { where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      items: {
        select: {
          id: true, quantity: true, unitPrice: true, totalPrice: true,
          product: { select: { name: true, imageUrl: true, images: true } },
          variant: { select: { name: true, imageUrl: true } },
        },
      },
    },
  },
  failures: {
    orderBy: { createdAt: "asc" },
    select: { orderId: true, reason: true, note: true, createdAt: true, order: { select: { deliveryAddress: true, user: { select: { name: true } } } } },
  },
} satisfies Prisma.DeliveryTripInclude;

export type CodOrder = { paymentMethod: string; totalAmount: unknown; walletAmountUsed: unknown; loyaltyPointsUsed: number | null; codCollectedVia: string | null };

/** What a COD order cost the customer at the door */
export const codDue = (o: CodOrder) =>
  o.paymentMethod === "COD" ? Math.max(0, Number(o.totalAmount) - Number(o.walletAmountUsed ?? 0) - Number(o.loyaltyPointsUsed ?? 0)) : 0;

interface TripForSummary {
  status: string;
  orders: ({ status: string; paymentStatus: string } & CodOrder)[];
  failures: unknown[];
}

/** A rider's day at a glance: trips, deliveries, failed attempts, cash collected and still to collect */
export function summarise(trips: TripForSummary[]) {
  const orders = trips.flatMap((t) => t.orders);
  const delivered = orders.filter((o) => o.status === "DELIVERED");
  return {
    trips: trips.length,
    tripsDone: trips.filter((t) => t.status === "COMPLETED").length,
    delivered: delivered.length,
    failed: trips.reduce((n, t) => n + t.failures.length, 0),
    // Cash is what the rider hands over; UPI went straight to the store
    cashCollected: delivered.filter((o) => o.codCollectedVia !== "UPI").reduce((sum, o) => sum + codDue(o), 0),
    upiCollected: delivered.filter((o) => o.codCollectedVia === "UPI").reduce((sum, o) => sum + codDue(o), 0),
    cashToCollect: orders.filter((o) => o.status !== "DELIVERED").reduce((sum, o) => sum + amountDue({ ...o, totalAmount: Number(o.totalAmount), walletAmountUsed: Number(o.walletAmountUsed ?? 0) }), 0),
  };
}

/** Everything a rider needs for a day: their trips with full stop details, and the day's summary */
export async function riderDay(prisma: PrismaClient, riderId: string, dateKey?: string) {
  const trips = await prisma.deliveryTrip.findMany({
    where: { riderId, ...tripsOnDay(dateKey) },
    include: RIDER_TRIP_INCLUDE,
    orderBy: [{ startedAt: "asc" }, { createdAt: "asc" }],
  });
  const withDue = trips.map((t) => ({
    ...t,
    orders: t.orders.map(({ statusLogs, ...o }) => ({
      ...o,
      deliveredAt: statusLogs[0]?.createdAt ?? null,
      amountDue: amountDue({ ...o, totalAmount: Number(o.totalAmount), walletAmountUsed: Number(o.walletAmountUsed ?? 0) }),
      amountCollected: o.status === "DELIVERED" ? codDue(o) : 0,
    })),
  }));
  return { date: istDay(dateKey).key, summary: summarise(trips), trips: withDue };
}

/** Per-rider summary for a store's day, for the manager to check cash handed over */
export async function storeRiderSummary(prisma: PrismaClient, storeId: string, dateKey?: string) {
  const trips = await prisma.deliveryTrip.findMany({
    where: { storeId, riderId: { not: null }, ...tripsOnDay(dateKey) },
    select: {
      riderId: true, status: true,
      orders: { select: { status: true, paymentMethod: true, paymentStatus: true, totalAmount: true, walletAmountUsed: true, loyaltyPointsUsed: true, codCollectedVia: true } },
      failures: { select: { id: true } },
    },
  });
  const byRider = new Map<string, typeof trips>();
  for (const t of trips) byRider.set(t.riderId as string, [...(byRider.get(t.riderId as string) ?? []), t]);
  return Object.fromEntries([...byRider.entries()].map(([id, list]) => [id, summarise(list)]));
}
