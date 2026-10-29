/**
 * Upload generated generic-product images to S3 and set imageUrl/images on the matching products.
 * Images come from scripts/taxonomy-images/generate.ts --level product (out/product/<slug>.webp),
 * where slug is derived from the product name. Matches master products tagged "generic", plus the fresh produce
 * named in data/produce-image-subjects.json, whose scraped variant photos are cleared so the gallery shows one image.
 * Filenames carry a content hash so a regenerated image never hits a stale cache. Idempotent.
 *
 * Run: cd apps/api && npx tsx prisma/seed-generic-product-images.ts [--produce | --missing]
 *   --produce: only the produce list; --missing: only products with no image yet (safe on prod when local images are stale)
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

dotenv.config();

const PRODUCE = join(dirname(fileURLToPath(import.meta.url)), "data/produce-image-subjects.json");
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
  const produce = Object.keys(JSON.parse(readFileSync(PRODUCE, "utf8")));
  const { values } = parseArgs({ options: { produce: { type: "boolean", default: false }, missing: { type: "boolean", default: false } } });
  const products = await prisma.product.findMany({
    where: values.produce
      ? { organizationId: null, name: { in: produce } }
      : { organizationId: null, OR: [{ tags: { has: "generic" } }, { name: { in: produce } }], ...(values.missing && { imageUrl: null }) },
    select: { id: true, name: true },
  });
  const missing = products.filter((p) => !existsSync(join(OUT, `${slugify(p.name)}.webp`))).map((p) => p.name);
  const ready = products.filter((p) => !missing.includes(p.name));

  let done = 0;
  for (let i = 0; i < ready.length; i += CONCURRENCY) {
    await Promise.all(ready.slice(i, i + CONCURRENCY).map(async (p) => {
      const url = await upload(slugify(p.name));
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: url, images: [url], variants: { updateMany: { where: {}, data: { imageUrl: null } } } },
      });
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
