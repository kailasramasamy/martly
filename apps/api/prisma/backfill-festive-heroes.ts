/**
 * Paints festive home heroes for live and upcoming festival collections that have none, or only the older style
 * (a painted background with no kicker line). Earliest first, so each one is designed against those before it.
 * Run: npx tsx prisma/backfill-festive-heroes.ts   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";
import { regenerateHero } from "../src/services/seasonal/index.js";

// The shell's OPENAI_API_KEY can shadow the one in .env; DATABASE_URL given on the command line still wins
const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

async function main() {
  const collections = await prisma.collection.findMany({
    where: {
      isActive: true,
      kind: { in: ["OCCASION", "SEASON"] },
      OR: [{ heroImageUrl: null }, { heroKicker: null }],
      organizationId: { not: null },
      AND: { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    },
    include: { festivalEvent: { select: { name: true, guidance: true } } },
    orderBy: { startsAt: { sort: "asc", nulls: "first" } },
  });
  console.log(`${collections.length} collections need a hero`);
  for (const collection of collections) {
    const hero = await regenerateHero(prisma, { ...collection, organizationId: collection.organizationId as string });
    console.log(hero ? `${collection.slug}: "${hero.heroTitle}" with ${hero.tiles.length} tiles` : `${collection.slug}: no tile themes, skipped`);
  }
}

main().finally(() => prisma.$disconnect());
