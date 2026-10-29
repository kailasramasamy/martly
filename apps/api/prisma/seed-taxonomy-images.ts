/**
 * Upload generated department/category/subcategory images to S3 and set imageUrl by slug.
 * Images come from scripts/taxonomy-images/generate.ts (out/<level>/<slug>.webp).
 * Filenames carry a content hash so a regenerated image never hits a stale cache.
 * Run: cd apps/api && npx tsx prisma/seed-taxonomy-images.ts [--missing]   (--missing: only rows with no image yet)
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

dotenv.config();

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../scripts/taxonomy-images/out");
const BUCKET = process.env.S3_BUCKET!;
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL!;
const KEY_PREFIX = process.env.S3_KEY_PREFIX ? `${process.env.S3_KEY_PREFIX}/` : "";
const LEVELS = ["department", "category", "subcategory"] as const;
const ONLY_MISSING = parseArgs({ options: { missing: { type: "boolean", default: false } } }).values.missing;

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function upload(level: string, slug: string): Promise<string> {
  const body = readFileSync(join(OUT, level, `${slug}.webp`));
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8);
  const key = `${KEY_PREFIX}taxonomy/${level}/${slug}-${hash}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${BASE_URL}/${key}`;
}

// Slugs at this level that have no image yet, so a partial run never replaces live images with stale local ones
async function withoutImage(level: (typeof LEVELS)[number]) {
  const where = { imageUrl: null };
  const select = { slug: true };
  const rows = await { department: () => prisma.department.findMany({ where, select }), category: () => prisma.category.findMany({ where, select }), subcategory: () => prisma.subcategory.findMany({ where, select }) }[level]();
  return new Set(rows.map((r) => r.slug));
}

async function seedLevel(level: (typeof LEVELS)[number]) {
  const files = readdirSync(join(OUT, level)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
  const missingImage = ONLY_MISSING ? await withoutImage(level) : null;
  const slugs = missingImage ? files.filter((slug) => missingImage.has(slug)) : files;
  const urls = await Promise.all(slugs.map(async (slug) => [slug, await upload(level, slug)] as const));

  const update = {
    department: (slug: string, imageUrl: string) => prisma.department.updateMany({ where: { slug }, data: { imageUrl } }),
    category: (slug: string, imageUrl: string) => prisma.category.updateMany({ where: { slug }, data: { imageUrl } }),
    subcategory: (slug: string, imageUrl: string) => prisma.subcategory.updateMany({ where: { slug }, data: { imageUrl } }),
  }[level];
  const results = await prisma.$transaction(urls.map(([slug, imageUrl]) => update(slug, imageUrl)));

  const missing = urls.filter((_, i) => results[i].count === 0).map(([slug]) => slug);
  console.log(`${level}: uploaded ${urls.length}, updated ${urls.length - missing.length}`);
  if (missing.length) console.warn(`  no ${level} with slug: ${missing.join(", ")}`);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`Seeding taxonomy images into ${host}`);
  for (const level of LEVELS) await seedLevel(level);
}

main().finally(() => prisma.$disconnect());
