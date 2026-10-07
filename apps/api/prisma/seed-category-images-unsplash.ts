/**
 * Seed category images (sidebar nav) from Unsplash — crop/resize to 128x128 PNG, upload to S3
 * Run: cd apps/api && npx tsx prisma/seed-category-images-unsplash.ts
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

// Sidebar icons are small (32-36px displayed), 128x128 source is enough
const TARGET_SIZE = 128;

// Unsplash images keyed by category name
const CAT_IMAGES: Record<string, string> = {
  // Baby Care
  "Baby Accessories": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=256&h=256&fit=crop&crop=center",
  "Baby Bath & Skin": "https://images.unsplash.com/photo-1596463989416-daf8d3786a1c?w=256&h=256&fit=crop&crop=center",
  "Baby Food & Formula": "https://images.unsplash.com/photo-1590080876351-941da357a4e4?w=256&h=256&fit=crop&crop=center",
  "Diapers & Wipes": "https://images.unsplash.com/photo-1584839404428-2b71e056bfcc?w=256&h=256&fit=crop&crop=center",

  // Bakery
  "Bakery Snacks": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=256&h=256&fit=crop&crop=center",
  "Bread": "https://images.unsplash.com/photo-1549931319-a545753467c8?w=256&h=256&fit=crop&crop=center",
  "Cakes & Pastries": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=256&h=256&fit=crop&crop=center",
  "Rusk": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=256&h=256&fit=crop&crop=center",

  // Beverages
  "Coffee": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=256&h=256&fit=crop&crop=center",
  "Health & Energy Drinks": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=256&h=256&fit=crop&crop=center",
  "Juices & Fruit Drinks": "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=256&h=256&fit=crop&crop=center",
  "Milk Drinks": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=256&h=256&fit=crop&crop=center",
  "Sherbet & Traditional": "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=256&h=256&fit=crop&crop=center",
  "Soft Drinks & Carbonated": "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=256&h=256&fit=crop&crop=center",
  "Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=256&h=256&fit=crop&crop=center",
  "Water": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=256&h=256&fit=crop&crop=center",

  // Dairy
  "Butter": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=256&h=256&fit=crop&crop=center",
  "Cheese": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=256&h=256&fit=crop&crop=center",
  "Condensed & Evaporated Milk": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=256&h=256&fit=crop&crop=center",
  "Cream & Dairy Whitener": "https://images.unsplash.com/photo-1587657162216-8cc81bd42b91?w=256&h=256&fit=crop&crop=center",
  "Curd & Yogurt": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=256&h=256&fit=crop&crop=center",
  "Milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=256&h=256&fit=crop&crop=center",
  "Paneer & Tofu": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=256&h=256&fit=crop&crop=center",

  // Frozen Foods
  "Frozen Meat & Seafood": "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=256&h=256&fit=crop&crop=center",
  "Frozen Snacks": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=256&h=256&fit=crop&crop=center",
  "Frozen Vegetables": "https://images.unsplash.com/photo-1580910365203-91ea9115a319?w=256&h=256&fit=crop&crop=center",
  "Ice Cream & Desserts": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=256&h=256&fit=crop&crop=center",

  // Fruits & Vegetables
  "Cut & Prepared": "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=256&h=256&fit=crop&crop=center",
  "Fresh Fruits": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=256&h=256&fit=crop&crop=center",
  "Fresh Herbs & Sprouts": "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=256&h=256&fit=crop&crop=center",
  "Fresh Vegetables": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=256&h=256&fit=crop&crop=center",
  "Organic Produce": "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=256&h=256&fit=crop&crop=center",

  // Gourmet & World Foods
  "Cooking Ingredients": "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=256&h=256&fit=crop&crop=center",
  "International Sauces & Spreads": "https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=256&h=256&fit=crop&crop=center",
  "International Snacks": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=256&h=256&fit=crop&crop=center",
  "Organic & Health Foods": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=256&h=256&fit=crop&crop=center",

  // Grocery & Staples
  "Atta & Flours": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=256&h=256&fit=crop&crop=center",
  "Dal & Pulses": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=256&h=256&fit=crop&crop=center",
  "Dry Fruits & Nuts": "https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=256&h=256&fit=crop&crop=center",
  "Edible Oils": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=256&h=256&fit=crop&crop=center",
  "Ghee": "https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=256&h=256&fit=crop&crop=center",
  "Papad & Fryums": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=256&h=256&fit=crop&crop=center",
  "Pickles & Chutney": "https://images.unsplash.com/photo-1589135233689-1e287345e84d?w=256&h=256&fit=crop&crop=center",
  "Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=256&h=256&fit=crop&crop=center",
  "Salt & Sugar": "https://images.unsplash.com/photo-1518110925495-5fe2c8f2be87?w=256&h=256&fit=crop&crop=center",
  "Sauces & Condiments": "https://images.unsplash.com/photo-1528750997573-59b0d0aee56d?w=256&h=256&fit=crop&crop=center",
  "Spices & Masala": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=256&h=256&fit=crop&crop=center",

  // Home Care
  "Air Fresheners & Repellents": "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=256&h=256&fit=crop&crop=center",
  "Cleaning Tools & Supplies": "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=256&h=256&fit=crop&crop=center",
  "Detergent": "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=256&h=256&fit=crop&crop=center",
  "Dishwash": "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=256&h=256&fit=crop&crop=center",
  "Floor & Surface Cleaners": "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=256&h=256&fit=crop&crop=center",
  "Paper & Disposables": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=256&h=256&fit=crop&crop=center",
  "Shoe Care": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=256&h=256&fit=crop&crop=center",

  // Meat, Fish & Eggs
  "Chicken": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=256&h=256&fit=crop&crop=center",
  "Eggs": "https://images.unsplash.com/photo-1491524062933-cb6c76a09bbb?w=256&h=256&fit=crop&crop=center",
  "Fish & Seafood": "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=256&h=256&fit=crop&crop=center",
  "Mutton & Lamb": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=256&h=256&fit=crop&crop=center",
  "Sausages & Cold Cuts": "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=256&h=256&fit=crop&crop=center",

  // Paan Corner
  "Mouth Freshener": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=256&h=256&fit=crop&crop=center",
  "Paan Masala & Tobacco": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=256&h=256&fit=crop&crop=center",

  // Personal Care
  "Bath & Body": "https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=256&h=256&fit=crop&crop=center",
  "Deodorants & Fragrances": "https://images.unsplash.com/photo-1541643600914-78b084683601?w=256&h=256&fit=crop&crop=center",
  "Feminine Hygiene": "https://images.unsplash.com/photo-1617897903246-719242758050?w=256&h=256&fit=crop&crop=center",
  "Hair Care": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=256&h=256&fit=crop&crop=center",
  "Health & Wellness": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=256&h=256&fit=crop&crop=center",
  "Men's Grooming": "https://images.unsplash.com/photo-1621607512022-6aecc149587d?w=256&h=256&fit=crop&crop=center",
  "Oral Care": "https://images.unsplash.com/photo-1559131397-f94da358f7ca?w=256&h=256&fit=crop&crop=center",
  "Skin Care": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=256&h=256&fit=crop&crop=center",

  // Pet Care
  "Cat Food & Treats": "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=256&h=256&fit=crop&crop=center",
  "Dog Food & Treats": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=256&h=256&fit=crop&crop=center",
  "Pet Accessories": "https://images.unsplash.com/photo-1583337130417-13104dec14a4?w=256&h=256&fit=crop&crop=center",

  // Pooja & Festivals
  "Festival Items": "https://images.unsplash.com/photo-1604422092498-ac945e165609?w=256&h=256&fit=crop&crop=center",
  "Pooja Essentials": "https://images.unsplash.com/photo-1603228254119-e6a4d095dc59?w=256&h=256&fit=crop&crop=center",
  "Pooja Offerings": "https://images.unsplash.com/photo-1590766742613-96988e45e689?w=256&h=256&fit=crop&crop=center",

  // Snacks & Packaged Foods
  "Biscuits & Cookies": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=256&h=256&fit=crop&crop=center",
  "Breakfast Cereals & Muesli": "https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=256&h=256&fit=crop&crop=center",
  "Canned & Preserved Foods": "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=256&h=256&fit=crop&crop=center",
  "Chips & Crisps": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=256&h=256&fit=crop&crop=center",
  "Chocolates & Confectionery": "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=256&h=256&fit=crop&crop=center",
  "Instant Noodles & Pasta": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=256&h=256&fit=crop&crop=center",
  "Namkeen & Savoury Snacks": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=256&h=256&fit=crop&crop=center",
  "Ready to Eat & Cook": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=256&h=256&fit=crop&crop=center",
  "Sweets & Mithai": "https://images.unsplash.com/photo-1589119908995-c6837fa14848?w=256&h=256&fit=crop&crop=center",

  // Stationery & General Merchandise
  "Batteries & Electricals": "https://images.unsplash.com/photo-1619641805634-a9eb76f02092?w=256&h=256&fit=crop&crop=center",
  "Kitchen Accessories": "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=256&h=256&fit=crop&crop=center",
  "Stationery": "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=256&h=256&fit=crop&crop=center",
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
  const filename = `categories/${slug}-${randomUUID().slice(0, 8)}.png`;
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
  console.log("Seeding category sidebar images...\n");

  const categories = await prisma.category.findMany({
    orderBy: [{ department: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, name: true, slug: true, imageUrl: true, department: { select: { name: true } } },
  });

  console.log(`Total categories: ${categories.length}`);
  console.log(`Mapped images: ${Object.keys(CAT_IMAGES).length}\n`);

  let success = 0;
  let failed = 0;
  let currentDept = "";

  // Process 5 concurrent downloads
  const BATCH_SIZE = 5;
  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batch = categories.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (cat) => {
        if (cat.department.name !== currentDept) {
          currentDept = cat.department.name;
        }

        const sourceUrl = CAT_IMAGES[cat.name];
        if (!sourceUrl) {
          console.warn(`  Skipped: ${cat.name} (no image mapped)`);
          failed++;
          return;
        }

        const raw = await downloadImage(sourceUrl);
        if (!raw) {
          console.warn(`  Failed download: ${cat.name}`);
          failed++;
          return;
        }

        const optimized = await processImage(raw);
        const url = await uploadToS3(optimized, cat.slug);

        await prisma.category.update({
          where: { id: cat.id },
          data: { imageUrl: url },
        });

        const kb = (optimized.length / 1024).toFixed(0);
        console.log(`  ${cat.department.name} > ${cat.name} — ${kb}KB`);
        success++;
      }),
    );
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Success: ${success}/${categories.length}`);
  console.log(`  Failed: ${failed}`);

  const withImages = await prisma.category.count({ where: { imageUrl: { not: null } } });
  console.log(`  Categories with images: ${withImages}/${categories.length}`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
