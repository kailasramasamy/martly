import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { HomeSectionEvent } from "@martly/shared/schemas";
import { istDateKey } from "../ist-day.js";

type Totals = { sectionType: string; views: number; taps: number; cartAdds: number };

/** Adds a batch of shopper events to today's per-section counts; an unknown store records nothing */
export async function recordHomeSectionEvents(prisma: PrismaClient, storeId: string, events: HomeSectionEvent[]) {
  const totals = new Map<string, Totals>();
  for (const e of events) {
    const t = totals.get(e.sectionId) ?? { sectionType: e.sectionType, views: 0, taps: 0, cartAdds: 0 };
    if (e.type === "VIEW") t.views += e.count;
    else if (e.type === "TAP") t.taps += e.count;
    else t.cartAdds += e.count;
    totals.set(e.sectionId, t);
  }
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) return 0;
  const date = new Date(`${istDateKey(new Date())}T00:00:00Z`);
  await prisma.$transaction([...totals].map(([sectionId, { sectionType, views, taps, cartAdds }]) =>
    prisma.homeSectionStatDaily.upsert({
      where: { storeId_sectionId_date: { storeId, sectionId, date } },
      create: { storeId, sectionId, sectionType, date, views, taps, cartAdds },
      update: { views: { increment: views }, taps: { increment: taps }, cartAdds: { increment: cartAdds } },
    })));
  return totals.size;
}
