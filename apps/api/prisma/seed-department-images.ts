/**
 * Generate department icons via OpenAI, crop/resize with sharp, upload to S3
 * Run: cd apps/api && npx tsx prisma/seed-department-images.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

// Target size for department icons — 256x256 is plenty for mobile display at 64-80px
const TARGET_SIZE = 256;

const DEPARTMENT_ITEMS: Record<string, string> = {
  "Baby Care": "a baby bottle with milk, a folded diaper, and a pastel pacifier",
  "Bakery": "a golden bread loaf, a flaky croissant, and a chocolate muffin",
  "Beverages": "a juice carton, a steaming coffee cup, and a water bottle",
  "Dairy": "a milk carton, a cheese wedge, and a yogurt cup with a spoon",
  "Frozen Foods": "an ice cream tub, a bag of frozen peas, and a popsicle",
  "Fruits & Vegetables": "a red apple, an orange carrot, and green broccoli",
  "Gourmet & World Foods": "an olive oil bottle, a pasta pack, and an exotic sauce jar",
  "Grocery & Staples": "a rice sack, a dal jar, and a wheat flour bag",
  "Home Care": "a cleaning spray bottle, a yellow sponge, and a detergent box",
  "Meat, Fish & Eggs": "a raw chicken leg, a whole fish, and a brown egg carton",
  "Paan Corner": "a green betel leaf, supari pieces, and a mouth freshener tin",
  "Personal Care": "a shampoo bottle, a soap bar, and a toothbrush",
  "Pet Care": "a pet food bowl, a bone treat, and a red pet collar",
  "Pooja & Festivals": "a lit brass diya lamp, incense sticks, and marigold flowers",
  "Snacks & Packaged Foods": "a chips bag, a biscuit pack, and a namkeen bowl",
  "Stationery & General Merchandise": "a spiral notebook, a ballpoint pen, and a tape roll",
};

async function generateDeptImage(deptName: string, items: string): Promise<Buffer | null> {
  try {
    console.log(`  Generating: ${deptName}...`);

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Create a single square icon for a grocery delivery app category called "${deptName}".

Style: Flat illustration, minimal detail, soft rounded shapes, no outlines. Similar to Blinkit, Zepto, or Instacart category icons.

Show ${items} arranged in a clean, centered composition.

Requirements:
- Soft pastel and vibrant colors, slight drop shadow for depth
- Transparent background (PNG with full alpha transparency)
- No text, no labels, no brand names
- Items slightly overlapping for visual interest
- Clean studio lighting, soft natural shadows only under objects
- Compact composition with padding around edges
- Must be instantly recognizable at 64x64px on a mobile screen

Style: Flat vector-style illustration, app icon quality, e-commerce ready.`,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      background: "transparent",
    });

    const b64 = response.data[0]?.b64_json;
    if (!b64) {
      console.warn(`  Warning: No image data for "${deptName}"`);
      return null;
    }

    return Buffer.from(b64, "base64");
  } catch (err) {
    console.warn(`  Failed: ${deptName} —`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function cropAndResize(buffer: Buffer): Promise<Buffer> {
  // Trim transparent pixels, then resize to target
  const trimmed = await sharp(buffer)
    .trim()  // auto-crop transparent borders
    .toBuffer();

  // Get trimmed dimensions
  const meta = await sharp(trimmed).metadata();
  const maxDim = Math.max(meta.width ?? 0, meta.height ?? 0);

  // If already small enough, just ensure it's square and resize
  const resized = await sharp(trimmed)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();

  return resized;
}

async function uploadToS3(buffer: Buffer, deptSlug: string): Promise<string> {
  const filename = `departments/${deptSlug}-${randomUUID().slice(0, 8)}.png`;
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
  console.log("Generating department images...\n");

  const departments = await prisma.department.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${departments.length} departments\n`);

  let success = 0;
  let failed = 0;

  for (const dept of departments) {
    const items = DEPARTMENT_ITEMS[dept.name];
    if (!items) {
      console.warn(`  Skipped: ${dept.name} (no prompt defined)`);
      failed++;
      continue;
    }

    // Generate
    const rawBuffer = await generateDeptImage(dept.name, items);
    if (!rawBuffer) { failed++; continue; }

    const rawSize = (rawBuffer.length / 1024).toFixed(0);

    // Crop & resize
    const optimized = await cropAndResize(rawBuffer);
    const optSize = (optimized.length / 1024).toFixed(0);

    console.log(`  Processed: ${rawSize}KB → ${optSize}KB (${TARGET_SIZE}x${TARGET_SIZE})`);

    // Upload
    const url = await uploadToS3(optimized, dept.slug);

    // Update database
    await prisma.department.update({
      where: { id: dept.id },
      data: { imageUrl: url },
    });

    console.log(`  Saved: ${dept.name} → ${url}\n`);
    success++;
  }

  console.log("\n--- Summary ---");
  console.log(`  Success: ${success}/${departments.length}`);
  console.log(`  Failed: ${failed}`);

  // Verify
  const withImages = await prisma.department.count({ where: { imageUrl: { not: null } } });
  console.log(`  Departments with images: ${withImages}/${departments.length}`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
