import type { CollectionKind } from "../../generated/prisma/client.js";

// Festivals lead seasons
const KIND_ORDER: Partial<Record<CollectionKind, number>> = { OCCASION: 0, SEASON: 1 };

export const FESTIVAL_DAYS_SELECT = { festivalEvent: { select: { startsAt: true, endsAt: true } } } as const;

export type FestivalRankable = {
  id: string;
  kind: CollectionKind;
  startsAt: Date | null;
  endsAt: Date | null;
  festivalEvent: { startsAt: Date; endsAt: Date } | null;
};

// The festival's own days; a collection with no calendar event stands for its live window
function festivalDays(c: FestivalRankable, now: Date) {
  const start = c.festivalEvent?.startsAt ?? c.startsAt ?? now;
  const end = c.festivalEvent?.endsAt ?? c.endsAt;
  return { day: Math.max(start.getTime(), now.getTime()), length: end ? end.getTime() - start.getTime() : Infinity };
}

/**
 * Live festivals in the order shoppers need them: festivals before seasons, then the nearest festival day (one
 * already under way counts as today), then the shorter festival, so a one-day festival leads a long one it falls in.
 */
export function rankFestivals<T extends FestivalRankable>(collections: T[], now: Date): T[] {
  return collections
    .map((c) => ({ c, kind: KIND_ORDER[c.kind] ?? 2, ...festivalDays(c, now) }))
    .sort((a, b) => a.kind - b.kind || a.day - b.day || (a.length === b.length ? 0 : a.length - b.length) || a.c.id.localeCompare(b.c.id))
    .map(({ c }) => c);
}
