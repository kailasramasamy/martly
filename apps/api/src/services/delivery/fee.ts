import type { PrismaClient } from "../../../generated/prisma/client.js";
import { haversine } from "../../lib/geo.js";
import { istNow } from "../ist-day.js";

interface FeeStore {
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number;
  baseDeliveryFee: unknown;
}

export interface DeliveryFee {
  fee: number;
  estimatedMinutes?: number;
  distance?: number;
  /** Past the store's delivery radius: it can't deliver there */
  outOfRange: boolean;
}

/** The fee and time to deliver to a point: its distance tier, else the store's zone, else the store's base fee */
export async function deliveryFeeTo(
  prisma: PrismaClient, storeId: string, store: FeeStore, point: { lat: number; lng: number } | null,
): Promise<DeliveryFee> {
  let fee = 0;
  let estimatedMinutes: number | undefined;
  let distance: number | undefined;
  let usedTier = false;
  if (store.latitude != null && store.longitude != null && point) {
    distance = haversine(point.lat, point.lng, store.latitude, store.longitude);
    if (distance > store.deliveryRadius) return { fee: 0, distance, outOfRange: true };
    const tier = await prisma.deliveryTier.findFirst({
      where: { storeId, isActive: true, minDistance: { lte: distance }, maxDistance: { gt: distance } },
    });
    if (tier) {
      fee = Number(tier.deliveryFee);
      estimatedMinutes = tier.estimatedMinutes;
      usedTier = true;
    }
  }
  if (!usedTier) {
    const zones = await prisma.storeDeliveryZone.findMany({ where: { storeId }, include: { deliveryZone: true } });
    const zone = zones.find((sz) => sz.deliveryZone.isActive)?.deliveryZone;
    if (zone) {
      fee = Number(zone.deliveryFee);
      estimatedMinutes = zone.estimatedMinutes;
    }
  }
  if (fee === 0 && store.baseDeliveryFee) fee = Number(store.baseDeliveryFee);
  return { fee, estimatedMinutes, distance, outOfRange: false };
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
