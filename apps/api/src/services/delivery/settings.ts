import type { PrismaClient } from "../../../generated/prisma/client.js";

export const DEFAULT_DELIVERY_SETTINGS = {
  maxOrdersPerTrip: 8,
  maxTripsPerRider: 2,
  expressBatchSize: 3,
  expressMaxWaitMinutes: 10,
  autoPlan: false,
};

export type DeliverySettings = typeof DEFAULT_DELIVERY_SETTINGS;

/** The store's fleet settings, or the defaults until a manager saves their own */
export async function deliverySettings(prisma: PrismaClient, storeId: string): Promise<DeliverySettings> {
  const row = await prisma.storeDeliverySettings.findUnique({ where: { storeId } });
  if (!row) return { ...DEFAULT_DELIVERY_SETTINGS };
  const { maxOrdersPerTrip, maxTripsPerRider, expressBatchSize, expressMaxWaitMinutes, autoPlan } = row;
  return { maxOrdersPerTrip, maxTripsPerRider, expressBatchSize, expressMaxWaitMinutes, autoPlan };
}

/** A YYYY-MM-DD day as the UTC-midnight Date that @db.Date columns store */
export const dateColumn = (key: string) => new Date(`${key}T00:00:00Z`);

/** Who works a slot on a given day: the weekly roster, adjusted by that day's overrides */
export async function slotRoster(prisma: PrismaClient, slotId: string, dateKey: string) {
  const [weekly, overrides] = await Promise.all([
    prisma.slotRider.findMany({ where: { slotId }, select: { rider: { select: { id: true, name: true, phone: true } } } }),
    prisma.slotRiderOverride.findMany({ where: { slotId, date: dateColumn(dateKey) }, select: { working: true, rider: { select: { id: true, name: true, phone: true } } } }),
  ]);
  const byId = new Map(weekly.map((w) => [w.rider.id, w.rider]));
  for (const o of overrides) {
    if (o.working) byId.set(o.rider.id, o.rider);
    else byId.delete(o.rider.id);
  }
  return [...byId.values()];
}

/** Orders the fleet can carry in a slot: roster riders × trips each × orders per trip */
export function fleetCapacity(riders: number, settings: Pick<DeliverySettings, "maxTripsPerRider" | "maxOrdersPerTrip">) {
  return riders * settings.maxTripsPerRider * settings.maxOrdersPerTrip;
}

/** Orders a slot can still take on a day: its own limit, or less when its roster can't carry that many */
export async function slotCapacity(prisma: PrismaClient, slot: { id: string; storeId: string; maxOrders: number }, dateKey: string) {
  const roster = await slotRoster(prisma, slot.id, dateKey);
  // A slot nobody has staffed yet keeps its plain limit, so stores that haven't set rosters keep taking orders
  if (roster.length === 0) return slot.maxOrders;
  return Math.min(slot.maxOrders, fleetCapacity(roster.length, await deliverySettings(prisma, slot.storeId)));
}
