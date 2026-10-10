/**
 * Upload generated generic-product images to S3 and set imageUrl/images on the matching products.
 * Images come from scripts/taxonomy-images/generate.ts --level product (out/product/<slug>.webp),
 * where slug is derived from the product name. Matches master products tagged "generic" only.
 * Filenames carry a content hash so a regenerated image never hits a stale cache. Idempotent.
 *
 * Run: cd apps/api && npx tsx prisma/seed-generic-product-images.ts
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../scripts/taxonomy-images/out/product");
const BUCKET = process.env.S3_BUCKET!;
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL!;
const KEY_PREFIX = process.env.S3_KEY_PREFIX ? `${process.env.S3_KEY_PREFIX}/` : "";
const CONCURRENCY = 8;

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const slugify = (s: string) => s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function upload(slug: string): Promise<string> {
  const body = readFileSync(join(OUT, `${slug}.webp`));
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8);
  const key = `${KEY_PREFIX}catalog/generic/${slug}-${hash}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${BASE_URL}/${key}`;
}

async function main() {
  console.log(`Seeding generic product images into ${new URL(process.env.DATABASE_URL!).host}`);
  const products = await prisma.product.findMany({
    where: { tags: { has: "generic" }, organizationId: null },
    select: { id: true, name: true },
  });
  const missing = products.filter((p) => !existsSync(join(OUT, `${slugify(p.name)}.webp`))).map((p) => p.name);
  const ready = products.filter((p) => !missing.includes(p.name));

  let done = 0;
  for (let i = 0; i < ready.length; i += CONCURRENCY) {
    await Promise.all(ready.slice(i, i + CONCURRENCY).map(async (p) => {
      const url = await upload(slugify(p.name));
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: url, images: [url] } });
      done++;
    }));
  }
  console.log(`✔ ${done} products updated (${products.length} generic products found)`);
  if (missing.length) console.warn(`  no image for: ${missing.join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
