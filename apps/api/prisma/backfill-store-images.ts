/**
 * Re-encodes store covers, logos, promo posters and banners that were uploaded as raw PNG/JPG into WebP (max 1600px wide).
 * Run: npx tsx prisma/backfill-store-images.ts   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "../generated/prisma/client.js";
import { isMediaUrl, optimizeImage, putObject } from "../src/services/media.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const converted = new Map<string, string>();

const needsOptimizing = (url: string | null): url is string => !!url && isMediaUrl(url) && /\.(png|jpe?g)$/i.test(url);

// Deterministic key so local and prod runs share one optimized copy
async function optimized(url: string) {
  const cached = converted.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const original = Buffer.from(await res.arrayBuffer());
  const webp = await optimizeImage(original);
  const { url: next } = await putObject(`optimized/${path.basename(url).replace(/\.\w+$/, "")}.webp`, webp, "image/webp");
  console.log(`${(original.length / 1024).toFixed(0)} KB → ${(webp.length / 1024).toFixed(0)} KB  ${path.basename(url)}`);
  converted.set(url, next);
  return next;
}

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, name: true, imageUrl: true, logoUrl: true, promoImages: true } });
  for (const store of stores) {
    const data: { imageUrl?: string; logoUrl?: string; promoImages?: string[] } = {};
    if (needsOptimizing(store.imageUrl)) data.imageUrl = await optimized(store.imageUrl);
    if (needsOptimizing(store.logoUrl)) data.logoUrl = await optimized(store.logoUrl);
    if (store.promoImages.some(needsOptimizing)) {
      data.promoImages = await Promise.all(store.promoImages.map((u) => (needsOptimizing(u) ? optimized(u) : u)));
    }
    if (Object.keys(data).length) {
      await prisma.store.update({ where: { id: store.id }, data });
      console.log(`  updated store ${store.name}: ${Object.keys(data).join(", ")}`);
    }
  }

  const banners = await prisma.banner.findMany({ select: { id: true, title: true, imageUrl: true } });
  for (const banner of banners.filter((b) => needsOptimizing(b.imageUrl))) {
    await prisma.banner.update({ where: { id: banner.id }, data: { imageUrl: await optimized(banner.imageUrl) } });
    console.log(`  updated banner ${banner.title}`);
  }
}

main().finally(() => prisma.$disconnect());
