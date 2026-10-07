/**
 * Seed department images from Unsplash, crop/resize with sharp, upload to S3
 * Fallback while OpenAI billing limit is reached.
 * Run: cd apps/api && npx tsx prisma/seed-department-images-unsplash.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const BUCKET = process.env.S3_BUCKET!;
const KEY_PREFIX = process.env.S3_KEY_PREFIX || "martly";
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL!;
const REGION = process.env.AWS_REGION || "ap-south-1";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TARGET_SIZE = 256;

// Curated Unsplash images for each department — square crop friendly
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
  "Meat, Fish & Eggs": "https://images.unsplash.com/photo-1604503468506-a8da13d82571?w=512&h=512&fit=crop&crop=center",
  "Paan Corner": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=512&h=512&fit=crop&crop=center",
  "Personal Care": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=512&h=512&fit=crop&crop=center",
  "Pet Care": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=512&h=512&fit=crop&crop=center",
  "Pooja & Festivals": "https://images.unsplash.com/photo-1606293459339-aa14e553e316?w=512&h=512&fit=crop&crop=center",
  "Snacks & Packaged Foods": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=512&h=512&fit=crop&crop=center",
  "Stationery & General Merchandise": "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=512&h=512&fit=crop&crop=center",
};

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
}

async function uploadToS3(buffer: Buffer, slug: string): Promise<string> {
  const filename = `departments/${slug}-${randomUUID().slice(0, 8)}.png`;
  const key = `${KEY_PREFIX}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000",
    }),
  );

  return `${BASE_URL}/${filename}`;
}

async function main() {
  console.log("Seeding department images from Unsplash...\n");

  const departments = await prisma.department.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${departments.length} departments\n`);

  let success = 0;

  for (const dept of departments) {
    const sourceUrl = DEPT_IMAGES[dept.name];
    if (!sourceUrl) {
      console.warn(`  Skipped: ${dept.name} (no image URL)`);
      continue;
    }

    console.log(`  Processing: ${dept.name}...`);

    const raw = await downloadImage(sourceUrl);
    if (!raw) {
      console.warn(`  Failed to download: ${dept.name}`);
      continue;
    }

    const rawKB = (raw.length / 1024).toFixed(0);
    const optimized = await processImage(raw);
    const optKB = (optimized.length / 1024).toFixed(0);

    console.log(`    ${rawKB}KB → ${optKB}KB (${TARGET_SIZE}x${TARGET_SIZE})`);

    const url = await uploadToS3(optimized, dept.slug);

    await prisma.department.update({
      where: { id: dept.id },
      data: { imageUrl: url },
    });

    console.log(`    Saved: ${url}`);
    success++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Success: ${success}/${departments.length}`);

  const withImages = await prisma.department.count({ where: { imageUrl: { not: null } } });
  console.log(`  Departments with images: ${withImages}/${departments.length}`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
