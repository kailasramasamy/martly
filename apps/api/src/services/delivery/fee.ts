import type { PrismaClient } from "../../../generated/prisma/client.js";
import { haversine } from "../../lib/geo.js";
import { istNow } from "../ist-day.js";

interface FeeStore {
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number;
}

export type DeliveryFee =
  | { serviceable: true; fee: number; estimatedMinutes: number; distance?: number }
  /** Past the radius, or no active tier covers the distance */
  | { serviceable: false; reason: "TOO_FAR" | "NO_TIER"; distance?: number };

/**
 * The fee and time to deliver to a point, from the store's distance tiers: the only place a delivery fee is set.
 * Without both locations the distance is unknown, so the nearest tier applies.
 */
export async function deliveryFeeTo(
  prisma: PrismaClient, storeId: string, store: FeeStore, point: { lat: number; lng: number } | null,
): Promise<DeliveryFee> {
  const tiers = await prisma.deliveryTier.findMany({ where: { storeId, isActive: true }, orderBy: { minDistance: "asc" } });
  const distance = store.latitude != null && store.longitude != null && point
    ? haversine(point.lat, point.lng, store.latitude, store.longitude)
    : undefined;
  if (distance !== undefined && distance > store.deliveryRadius) return { serviceable: false, reason: "TOO_FAR", distance };
  const tier = distance === undefined ? tiers[0] : tiers.find((t) => t.minDistance <= distance && t.maxDistance > distance);
  if (!tier) return { serviceable: false, reason: "NO_TIER", distance };
  return { serviceable: true, fee: Number(tier.deliveryFee), estimatedMinutes: tier.estimatedMinutes, distance };
}

/** Each store's lowest active tier fee, shown to shoppers as "Delivery from ₹20" */
export async function deliveryFeesFrom(prisma: PrismaClient, storeIds: string[]): Promise<Map<string, number>> {
  const lowest = await prisma.deliveryTier.groupBy({
    by: ["storeId"], where: { storeId: { in: storeIds }, isActive: true }, _min: { deliveryFee: true },
  });
  return new Map(lowest.map((t) => [t.storeId, Number(t._min.deliveryFee ?? 0)]));
}

/** Express runs all day without set hours; otherwise only between them, India time */
export function expressOutsideHours(config: { operatingStart: string | null; operatingEnd: string | null }) {
  if (!config.operatingStart || !config.operatingEnd) return false;
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const now = istNow().minutes;
  return now < toMinutes(config.operatingStart) || now >= toMinutes(config.operatingEnd);
}
