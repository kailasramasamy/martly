/**
 * Fix 2 failed department images + re-process all as transparent PNGs
 * Run: cd apps/api && npx tsx prisma/seed-dept-images-fix.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.S3_BUCKET || "";
const KEY_PREFIX = process.env.S3_KEY_PREFIX || "martly";
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL || "";
const TARGET_SIZE = 256;

const DEPT_IMAGES: Record<string, string> = {
  "Baby Care": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=512&h=512&fit=crop&crop=center",
  "Bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=512&h=512&fit=crop&crop=center",
  "Beverages": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=512&h=512&fit=crop&crop=center",
  "Dairy": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=512&h=512&fit=crop&crop=center",
  "Frozen Foods": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=512&h=512&fit=crop&crop=center",
  "Fruits & Vegetables": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=512&h=512&fit=crop&crop=center",
  "Gourmet & World Foods": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=512&h=512&fit=crop&crop=center",
  "Grocery & Staples": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=512&h=512&fit=crop&crop=center",
  "Home Care": "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=512&h=512&fit=crop&crop=center",
  "Meat, Fish & Eggs": "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=512&h=512&fit=crop&crop=center",
  "Paan Corner": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=512&h=512&fit=crop&crop=center",
  "Personal Care": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=512&h=512&fit=crop&crop=center",
  "Pet Care": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=512&h=512&fit=crop&crop=center",
  "Pooja & Festivals": "https://images.unsplash.com/photo-1603228254119-e6a4d095dc59?w=512&h=512&fit=crop&crop=center",
  "Snacks & Packaged Foods": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=512&h=512&fit=crop&crop=center",
  "Stationery & General Merchandise": "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=512&h=512&fit=crop&crop=center",
};

async function processImage(buffer: Buffer): Promise<Buffer> {
  // Resize to target, crop to circle-friendly square, output as PNG with transparency
  return sharp(buffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  console.log("Fixing department images...\n");

  const departments = await prisma.department.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });

  // Process departments missing images or explicitly listed for replacement
  const replaceNames = new Set(["Stationery & General Merchandise"]);
  const toFix = departments.filter((d) => !d.imageUrl || replaceNames.has(d.name));
  console.log(`${toFix.length} departments need images\n`);

  for (const dept of toFix) {
    const url = DEPT_IMAGES[dept.name];
    if (!url) { console.log(`  Skipped: ${dept.name}`); continue; }

    console.log(`  Processing: ${dept.name}...`);
    const res = await fetch(url);
    if (!res.ok) { console.log(`  Download failed (${res.status})`); continue; }

    const raw = Buffer.from(await res.arrayBuffer());
    const optimized = await processImage(raw);
    console.log(`    ${(raw.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB`);

    const filename = `departments/${dept.slug}-${randomUUID().slice(0, 8)}.png`;
    const key = `${KEY_PREFIX}/${filename}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: optimized, ContentType: "image/png", CacheControl: "public, max-age=31536000" }));

    const savedUrl = `${BASE_URL}/${filename}`;
    await prisma.department.update({ where: { id: dept.id }, data: { imageUrl: savedUrl } });
    console.log(`    Saved: ${savedUrl}`);
  }

  const withImages = await prisma.department.count({ where: { imageUrl: { not: null } } });
  console.log(`\nDepartments with images: ${withImages}/${departments.length}`);
  console.log("Done!");
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
