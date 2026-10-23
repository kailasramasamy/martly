import type { AdProduct, BannerPlacement, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getMarketingConfig } from "../marketing/config.js";

export type Db = PrismaClient | Prisma.TransactionClient;
export type Package = Pick<AdProduct, "kind" | "placement">;

// Placements whose slots are counted per category rather than across the network
const PER_CATEGORY: BannerPlacement[] = ["CATEGORY_TOP", "SPONSORED_PRODUCT"];
/** Campaigns that hold a slot: unpaid ones too (until they lapse), so a slot can't be sold twice */
export const HOLDING = ["PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED", "LIVE"] as const;

/** A package's slots: its banner placement, or for featured brands (no banner) the featured list, per category */
export const slotKey = (p: Package) => p.placement ?? p.kind;

/** How many campaigns the package's slot takes at once; null means no limit */
export async function slotCap(db: Db, { placement }: Package) {
  const config = await getMarketingConfig(db);
  return placement ? config.slotLimits[placement]?.BRAND ?? null : config.featuredBrandSlots;
}

/** Campaigns holding the package's slot (in its category where slots are per category) still running after `after` */
export function heldInSlot<S extends Prisma.BrandCampaignSelect>(
  db: Db, slot: { product: Package; categoryId?: string | null; excludeId?: string; after: Date }, select: S,
) {
  const { placement, kind } = slot.product;
  return db.brandCampaign.findMany({
    where: {
      status: { in: [...HOLDING] }, endsAt: { gt: slot.after },
      ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
      ...(placement ? { placement } : { product: { kind } }),
      ...(!placement || PER_CATEGORY.includes(placement) ? { categoryId: slot.categoryId } : {}),
    },
    orderBy: { startsAt: "asc" },
    select,
  });
}

type Span = { startsAt: Date; endsAt: Date };

/**
 * The most campaigns running at one moment within [from, to): a slot is full only when they'd run at the same time, so
 * one that ends as another starts doesn't double-count. The count only rises when a campaign starts, so checking the
 * window's start and each start inside it finds the peak.
 */
export function peakRunning(held: Span[], from: number, to: number) {
  const moments = [from, ...held.map((h) => h.startsAt.getTime()).filter((t) => t > from && t < to)];
  return Math.max(...moments.map((t) => held.filter((h) => h.startsAt.getTime() <= t && h.endsAt.getTime() > t).length));
}

/**
 * The earliest moment from `from` on (and before `until`, when given) at which a booking of this length fits. It's
 * always `from` or the moment a held campaign ends, as sliding a window back to the last such moment never raises the
 * peak.
 */
export function firstFit(held: Span[], cap: number | null, length: number, from: number, until = Infinity) {
  const fits = (t: number) => cap === null || peakRunning(held, t, t + length) < cap;
  const candidates = [from, ...held.map((h) => h.endsAt.getTime()).filter((t) => t > from && t < until).sort((a, b) => a - b)];
  return candidates.find((t) => t < until && fits(t)) ?? null;
}

/** How full the slot is for this window, counted at its busiest moment, and when it's full the earliest start that fits */
export async function availability(db: Db, slot: { product: Package; categoryId?: string | null; startsAt: Date; endsAt: Date; excludeId?: string }) {
  const cap = await slotCap(db, slot.product);
  const held = await heldInSlot(db, { ...slot, after: slot.startsAt }, { startsAt: true, endsAt: true });
  const start = slot.startsAt.getTime();
  const length = slot.endsAt.getTime() - start;
  const booked = peakRunning(held, start, start + length);
  const available = cap === null || booked < cap;
  const next = available ? null : firstFit(held, cap, length, start);
  return { cap, booked, available, nextStartsAt: next === null ? null : new Date(next) };
}
