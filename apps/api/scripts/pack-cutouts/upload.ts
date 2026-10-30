/**
 * Upload reviewed pack cutouts (from cut.py) and attach them to their products, for category pack tiles.
 *
 * Usage: cd apps/api && npx tsx scripts/pack-cutouts/upload.ts <dir> [--prod]
 * <dir> holds one transparent PNG per product, named <productId>.png. --prod runs against PROD_DATABASE_URL.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "../../generated/prisma/index.js";
import { putObject } from "../../src/services/media.js";

const dir = process.argv[2];
const prod = process.argv.includes("--prod");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);

async function main() {
  if (!dir) throw new Error("Pass the folder of <productId>.png cutouts");
  const files = readdirSync(dir).filter((f) => f.endsWith(".png"));
  console.log(`${prod ? "PROD" : "local"}: ${files.length} cutouts`);
  for (const file of files) {
    const productId = file.replace(/\.png$/, "");
    const image = readFileSync(join(dir, file));
    const { width, height } = await sharp(image).metadata();
    if (!width || !height) throw new Error(`${file} has no size`);
    // The content hash in the name lets a recut replace a cached tile
    const hash = createHash("sha1").update(image).digest("hex").slice(0, 8);
    const { url } = await putObject(`catalog/pack-cutouts/${productId}-${hash}.png`, image, "image/png");
    const { count } = await prisma.product.updateMany({ where: { id: productId }, data: { packCutoutUrl: url, packCutoutAspect: width / height } });
    console.log(`${count ? "ok  " : "MISSING"} ${productId} ${width}×${height}`);
  }
}

main().finally(() => prisma.$disconnect());
