/**
 * Festival calendar for the seasonal curation agent, loaded from prisma/data/festival-calendar.json
 * (Oct 2026 – Oct 2027, pan-India plus regional festivals and seasons). Lunar dates were checked against
 * Drik Panchang and state holiday lists in Oct 2026; Islamic dates are tentative on moon sighting.
 * Upserts by slug, so re-running updates dates and guidance without touching curated collections.
 * Also links the hand-made collections from seed-search-landing.ts to their events so the agent doesn't
 * duplicate them, and opts orgs still on the default pan-India calendar into Tamil Nadu (every store is in TN).
 * Run: cd apps/api && npx tsx prisma/seed-festival-calendar.ts
 */

import { readFileSync } from "node:fs";
import { createFestivalEventSchema } from "@martly/shared/schemas";
import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Collections made by seed-search-landing.ts, keyed by the event they cover
const MANUAL_COLLECTIONS: Record<string, string> = {
  "diwali-2026": "diwali-specials-2026",
  "christmas-2026": "christmas-new-year-2026",
  "pongal-2027": "pongal-essentials-2027",
  "winter-2026-27": "winter-warmers-2026",
  "summer-2027": "summer-coolers-2027",
};

const istMidnight = (day: string) => `${day}T00:00:00+05:30`;
const istEndOfDay = (day: string) => `${day}T23:59:59.999+05:30`;

function loadEvents() {
  const raw = JSON.parse(readFileSync(new URL("./data/festival-calendar.json", import.meta.url), "utf8")) as Record<string, unknown>[];
  return raw.map((e) => createFestivalEventSchema.parse({
    ...e,
    startsAt: istMidnight(e.startsAt as string),
    endsAt: istEndOfDay(e.endsAt as string),
  }));
}

async function main() {
  const events = loadEvents();
  const opted = await prisma.organization.updateMany({
    where: { festivalRegions: { equals: ["ALL"] } },
    data: { festivalRegions: ["ALL", "TN"] },
  });
  console.log(`${opted.count} org(s) now follow ALL + TN`);

  for (const data of events) {
    const event = await prisma.festivalEvent.upsert({ where: { slug: data.slug }, update: data, create: data });
    const manual = MANUAL_COLLECTIONS[data.slug];
    const linked = manual
      ? await prisma.collection.updateMany({ where: { slug: manual, festivalEventId: null }, data: { festivalEventId: event.id } })
      : { count: 0 };
    const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    console.log(`  ${data.kind.padEnd(8)} ${data.name.padEnd(32)} ${day(event.startsAt)} → ${day(event.endsAt)}  [${data.regions.join(",")}]${linked.count ? " (linked)" : ""}`);
  }
  console.log(`${events.length} events seeded`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
