/**
 * Paints festive home heroes for live and upcoming festival collections curated before heroes existed.
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
      heroImageUrl: null,
      organizationId: { not: null },
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    include: { festivalEvent: { select: { name: true, guidance: true } } },
    orderBy: { endsAt: "asc" },
  });
  console.log(`${collections.length} collections need a hero`);
  for (const collection of collections) {
    const hero = await regenerateHero(prisma, { ...collection, organizationId: collection.organizationId as string });
    console.log(hero ? `${collection.slug}: "${hero.heroTitle}" with ${hero.tiles.length} tiles` : `${collection.slug}: no tile themes, skipped`);
  }
}

main().finally(() => prisma.$disconnect());
