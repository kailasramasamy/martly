import { FESTIVAL_REGIONS } from "@martly/shared/constants";
import type { FestivalEvent, Prisma } from "../../../generated/prisma/client.js";
import { liveFrom } from "./due-events.js";

const DAY_MS = 86_400_000;
const UPCOMING_WINDOW_DAYS = 30;

export type FestivalPhase = "LIVE" | "UPCOMING" | "ENDED";

type CalendarRow = FestivalEvent & { collections: { isActive: boolean }[] };

/** Live means shoppers can see it now: between the lead date and the festival's end. */
export function festivalPhase(event: Pick<FestivalEvent, "startsAt" | "endsAt" | "leadDays">, now: Date): FestivalPhase {
  if (event.endsAt < now) return "ENDED";
  return liveFrom(event) <= now ? "LIVE" : "UPCOMING";
}

/** Matches the event name, a region code ("TN") or part of a region name ("tamil"). */
export function calendarWhere(q: string | undefined, orgRegions: string[] | null): Prisma.FestivalEventWhereInput {
  const and: Prisma.FestivalEventWhereInput[] = [];
  // ORG_ADMIN only sees the calendar for the regions their org follows
  if (orgRegions) and.push({ OR: [{ regions: { has: "ALL" } }, { regions: { hasSome: orgRegions } }] });
  const term = q?.trim();
  if (term) {
    const codes = Object.entries(FESTIVAL_REGIONS)
      .filter(([code, label]) => code.toLowerCase() === term.toLowerCase() || label.toLowerCase().includes(term.toLowerCase()))
      .map(([code]) => code);
    and.push({ OR: [{ name: { contains: term, mode: "insensitive" } }, ...(codes.length ? [{ regions: { hasSome: codes } }] : [])] });
  }
  return { AND: and };
}

const PHASE_ORDER: Record<FestivalPhase, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2 };

/** Live first (ending soonest), then upcoming (starting soonest), then ended (most recent first). */
export function sortCalendar<T extends CalendarRow>(rows: T[], now: Date) {
  const key = (e: T) => {
    const phase = festivalPhase(e, now);
    if (phase === "LIVE") return e.endsAt.getTime();
    if (phase === "UPCOMING") return liveFrom(e).getTime();
    return -e.endsAt.getTime();
  };
  return rows
    .map((e) => ({ ...e, phase: festivalPhase(e, now), liveFrom: liveFrom(e) }))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || key(a) - key(b));
}

export function calendarSummary(rows: CalendarRow[], now: Date) {
  const soon = now.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS;
  const curated = rows.filter((e) => e.collections.length > 0);
  return {
    total: rows.length,
    live: rows.filter((e) => festivalPhase(e, now) === "LIVE").length,
    upcoming30d: rows.filter((e) => festivalPhase(e, now) === "UPCOMING" && liveFrom(e).getTime() <= soon).length,
    curated: curated.length,
    awaitingGoLive: curated.filter((e) => festivalPhase(e, now) === "UPCOMING" && e.collections.some((c) => c.isActive)).length,
    vetoed: curated.filter((e) => e.collections.every((c) => !c.isActive)).length,
  };
}
