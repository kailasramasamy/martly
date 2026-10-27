import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { WebStoreDelivery, WebStoreProfile } from "@martly/shared/types";
import { dealsByStore } from "../store-discovery.js";
import { upcomingSlots, type OpenSlot } from "../delivery/slot-availability.js";
import { istNow } from "../ist-day.js";

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type ExpressHours = { etaMinutes: number | null; operatingStart: string | null; operatingEnd: string | null } | null;

/** Express delivery and hours, and the next bookable slot, as the app's store card shows them */
export function deliveryOf(express: ExpressHours, slot: OpenSlot | undefined): WebStoreDelivery {
  const now = istNow();
  const hours = express?.operatingStart && express.operatingEnd ? { opens: express.operatingStart, closes: express.operatingEnd } : null;
  return {
    expressMinutes: express?.etaMinutes ?? null,
    hours,
    openNow: hours ? now.minutes >= minutesOf(hours.opens) && now.minutes < minutesOf(hours.closes) : null,
    today: now.key,
    nextSlot: slot ? { date: slot.date, startTime: slot.startTime, endTime: slot.endTime } : null,
  };
}

async function storeDelivery(prisma: PrismaClient, storeId: string) {
  const [express, slots] = await Promise.all([
    prisma.expressDeliveryConfig.findFirst({ where: { storeId, isEnabled: true }, select: { etaMinutes: true, operatingStart: true, operatingEnd: true } }),
    upcomingSlots(prisma, [storeId], 1),
  ]);
  return deliveryOf(express, slots.get(storeId)?.[0]);
}

/** The store's branding, address, free-delivery line, rating, live deals and delivery for Home's store header */
export async function storeProfile(prisma: PrismaClient, storeId: string): Promise<WebStoreProfile> {
  const [store, rating, deals, delivery] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { brandColor: true, tagline: true, offerText: true, address: true, freeDeliveryThreshold: true },
    }),
    prisma.storeRating.aggregate({ where: { storeId }, _avg: { overallRating: true }, _count: { _all: true } }),
    dealsByStore(prisma, [storeId]),
    storeDelivery(prisma, storeId),
  ]);
  const average = rating._avg.overallRating;
  return {
    brandColor: store.brandColor,
    tagline: store.tagline,
    offerText: store.offerText,
    address: store.address,
    freeDeliveryAbove: store.freeDeliveryThreshold == null ? null : Number(store.freeDeliveryThreshold),
    rating: average == null ? null : { average: Math.round(average * 10) / 10, count: rating._count._all },
    deals: deals.get(storeId) ?? null,
    delivery,
  };
}
