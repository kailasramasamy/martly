import type { FestivalEvent, PrismaClient } from "../../../generated/prisma/client.js";

const DAY_MS = 86_400_000;
// Drafts appear this many days before they go live, giving admins a window to veto them
export const REVIEW_DAYS = 7;

export interface CurationOrg {
  id: string;
  name: string;
  slug: string;
  festivalRegions: string[];
}

export function liveFrom(event: Pick<FestivalEvent, "startsAt" | "leadDays">) {
  return new Date(event.startsAt.getTime() - event.leadDays * DAY_MS);
}

export function matchesRegions(event: Pick<FestivalEvent, "regions">, org: Pick<CurationOrg, "festivalRegions">) {
  return event.regions.includes("ALL") || event.regions.some((r) => org.festivalRegions.includes(r));
}

function isDue(event: FestivalEvent, now: Date) {
  return liveFrom(event).getTime() - REVIEW_DAYS * DAY_MS <= now.getTime() && now < event.endsAt;
}

/** Org × event pairs that are inside the curation window and have no collection yet. */
export async function findDueCurations(prisma: PrismaClient, now = new Date()) {
  const [events, orgs] = await Promise.all([
    prisma.festivalEvent.findMany({
      where: { isActive: true, endsAt: { gt: now } },
      include: { collections: { select: { organizationId: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.organization.findMany({ select: { id: true, name: true, slug: true, festivalRegions: true } }),
  ]);
  return events.filter((e) => isDue(e, now)).flatMap(({ collections, ...event }) => {
    const done = new Set(collections.map((c) => c.organizationId));
    return orgs.filter((org) => !done.has(org.id) && matchesRegions(event, org)).map((org) => ({ org, event }));
  });
}
