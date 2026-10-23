/**
 * Moves every festive hero from a solid festival colour with white text to a pale wash with deep ink. Each strip
 * is recoloured from its own pixels (its edges are the old theme colour), so no image is regenerated; tiles stay.
 * Heroes already on a wash (dark: false) are skipped, so a rerun only picks up what's left.
 * Run: npx tsx prisma/repaint-festive-heroes-pastel.ts   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";
import { prepareStrip, uploadHeroArt, washTheme, type HeroTheme } from "../src/services/seasonal/hero-art.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const collections = await prisma.collection.findMany({
    where: { heroImageUrl: { not: null }, heroTheme: { path: ["dark"], equals: true } },
    select: { id: true, slug: true, heroImageUrl: true, heroTheme: true },
  });
  console.log(`${collections.length} heroes to repaint`);
  for (const c of collections) {
    const old = c.heroTheme as unknown as HeroTheme;
    const heroTheme: HeroTheme = { ...washTheme(old.background), ...(old.font ? { font: old.font } : {}) };
    const strip = await prepareStrip(await download(c.heroImageUrl as string), heroTheme);
    const heroImageUrl = await uploadHeroArt(strip, c.slug, "strip");
    await prisma.collection.update({ where: { id: c.id }, data: { heroImageUrl, heroTheme: { ...heroTheme } } });
    console.log(`${c.slug}: ${old.background} -> wash ${heroTheme.background}, ink ${heroTheme.title}`);
  }
}

main().finally(() => prisma.$disconnect());
