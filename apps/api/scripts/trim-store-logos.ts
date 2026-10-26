/**
 * Trim the empty margins off store logos uploaded before uploads did it, so wide wordmarks fill their plate.
 *
 * Usage: cd apps/api && npx tsx scripts/trim-store-logos.ts [--prod] [--dry-run]
 * --prod runs against PROD_DATABASE_URL. Logos whose mark already fills the image are left alone.
 * The old files stay in the bucket, so a logo can be pointed back at its old URL.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import sharp from "sharp";
import { PrismaClient } from "../generated/prisma/index.js";
import { trimLogo } from "../src/services/brand-logo.js";
import { putObject } from "../src/services/media.js";

// Trim only when the margins take more than this share of the image
const MIN_SAVING = 0.1;

const prod = process.argv.includes("--prod");
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);

async function main() {
  const stores = await prisma.store.findMany({ where: { logoUrl: { not: null } }, select: { id: true, name: true, slug: true, logoUrl: true } });
  console.log(`${prod ? "PROD" : "local"}: ${stores.length} stores with a logo${dryRun ? " (dry run)" : ""}`);
  for (const store of stores) {
    const res = await fetch(store.logoUrl!);
    if (!res.ok) { console.log(`skip ${store.name}: ${res.status} fetching logo`); continue; }
    const original = Buffer.from(await res.arrayBuffer());
    const before = await sharp(original).metadata();
    const trimmed = await trimLogo(original);
    const after = await sharp(trimmed).metadata();
    const saving = 1 - (after.width! * after.height!) / Math.min(before.width! * before.height!, 512 * 512);
    const shape = `${before.width}x${before.height} -> ${after.width}x${after.height}`;
    if (saving < MIN_SAVING) { console.log(`keep ${store.name}: ${shape}`); continue; }
    if (dryRun) { console.log(`would trim ${store.name}: ${shape}`); continue; }
    const { url } = await putObject(`stores/${store.slug}-${Date.now().toString(36)}.webp`, trimmed, "image/webp");
    await prisma.store.update({ where: { id: store.id }, data: { logoUrl: url } });
    console.log(`trimmed ${store.name}: ${shape}\n  was ${store.logoUrl}\n  now ${url}`);
  }
}

main().finally(() => prisma.$disconnect());
