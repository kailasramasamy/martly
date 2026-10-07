/**
 * Fix missing category images
 * Run: cd apps/api && npx tsx prisma/seed-cat-images-fix.ts
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
const TARGET_SIZE = 128;

const FIXES: Record<string, string> = {
  "Baby Bath & Skin": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=300&h=300&fit=crop&crop=top",
  "Baby Food & Formula": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&h=300&fit=crop&crop=center",
  "Bath & Body": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop&crop=center",
  "Batteries & Electricals": "https://images.unsplash.com/photo-1609692814858-f7cd2f0afa4f?w=300&h=300&fit=crop&crop=center",
  "Bread": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop&crop=center",
  "Cream & Dairy Whitener": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop&crop=center",
  "Diapers & Wipes": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&h=300&fit=crop&crop=center",
  "Eggs": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop&crop=center",
  "Festival Items": "https://images.unsplash.com/photo-1603228254119-e6a4d095dc59?w=300&h=300&fit=crop&crop=center",
  "Men's Grooming": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300&h=300&fit=crop&crop=center",
  "Pet Accessories": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300&h=300&fit=crop&crop=center",
  "Pickles & Chutney": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300&h=300&fit=crop&crop=center",
  "Pooja Offerings": "https://images.unsplash.com/photo-1603228254119-e6a4d095dc59?w=300&h=300&fit=crop&crop=top",
  "Salt & Sugar": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&h=300&fit=crop&crop=center",
  "Sauces & Condiments": "https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=300&h=300&fit=crop&crop=center",
};

async function main() {
  console.log("Fixing missing category images...\n");

  const missing = await prisma.category.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  console.log(`${missing.length} categories need images\n`);

  let success = 0;
  for (const cat of missing) {
    const url = FIXES[cat.name];
    if (!url) { console.log(`  No URL for: ${cat.name}`); continue; }

    try {
      const res = await fetch(url);
      if (!res.ok) { console.log(`  Failed (${res.status}): ${cat.name}`); continue; }

      const raw = Buffer.from(await res.arrayBuffer());
      const optimized = await sharp(raw)
        .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
        .png({ quality: 80, compressionLevel: 9 })
        .toBuffer();

      const filename = `categories/${cat.slug}-${randomUUID().slice(0, 8)}.png`;
      const key = `${KEY_PREFIX}/${filename}`;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: optimized, ContentType: "image/png", CacheControl: "public, max-age=31536000" }));

      const savedUrl = `${BASE_URL}/${filename}`;
      await prisma.category.update({ where: { id: cat.id }, data: { imageUrl: savedUrl } });
      console.log(`  ${cat.name} — ${(optimized.length / 1024).toFixed(0)}KB`);
      success++;
    } catch (e) {
      console.log(`  Error: ${cat.name} — ${e instanceof Error ? e.message : e}`);
    }
  }

  const total = await prisma.category.count();
  const withImages = await prisma.category.count({ where: { imageUrl: { not: null } } });
  console.log(`\nFixed: ${success}/${missing.length}`);
  console.log(`Categories with images: ${withImages}/${total}`);
  console.log("Done!");
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
