import dotenv from "dotenv";
dotenv.config({ override: true });
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import {
  PrismaClient,
  UnitType,
  FoodType,
  ProductType,
  StorageType,
} from "../generated/prisma/index.js";

// ── Config ───────────────────────────────────────────────────

const prisma = new PrismaClient();

const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? "media-image-upload";
const KEY_PREFIX = process.env.S3_KEY_PREFIX ?? "martly";
const BASE_URL =
  process.env.MEDIA_PUBLIC_BASE_URL ??
  `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com/${KEY_PREFIX}`;

// ── Types ────────────────────────────────────────────────────

interface ProductData {
  categoryPath: string;
  name: string;
  brand: string;
  description: string;
  productType: string;
  hsnCode: string;
  gstPercent: number;
  foodType?: string;
  storageType?: string;
  fssaiLicense?: string;
  regulatoryMarks: string[];
  certifications: string[];
  mfgLicenseNo?: string | null;
  dangerWarnings?: string | null;
  usageInstructions?: string | null;
  ingredients?: string;
  nutritionalInfo?: Record<string, string>;
  allergens: string[];
  servingSize?: string;
  shelfLifeDays?: number;
  storageInstructions?: string;
  manufacturerName?: string;
  countryOfOrigin?: string;
  textureHint: string;
  tags: string[];
  variants: Array<{
    name: string;
    sku: string;
    barcode?: string;
    unitType: string;
    unitValue: number;
    mrp: number;
    packType?: string;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Claude Prompt ────────────────────────────────────────────

const CLAUDE_PROMPT = `Generate a JSON array of exactly 50 unbranded Indian grocery staples.

These are GENERIC grocery items — NO brand names. The "brand" field should be null for all products.
Think: Toor Dal, Basmati Rice, Whole Wheat Atta, Chana Dal, Moong Dal, Masoor Dal, Urad Dal, Sugar, Salt, Turmeric Powder, Red Chilli Powder, Coriander Powder, Cumin Seeds, Mustard Seeds, Sona Masoori Rice, Poha, Sooji, Besan, Maida, Jaggery, Black Pepper, Rajma, Chole, Peanuts, Cashews, Almonds, Raisins, etc.

Return ONLY valid JSON (no markdown, no explanation). The JSON should be an array of objects with this exact structure:

[
  {
    "categoryPath": "Grocery > Pulses & Lentils",
    "name": "Toor Dal",
    "brand": null,
    "description": "Premium quality split pigeon peas (arhar dal), cleaned and polished",
    "productType": "GROCERY",
    "hsnCode": "0713",
    "gstPercent": 0,
    "foodType": "VEGAN",
    "storageType": "COOL_DRY",
    "fssaiLicense": null,
    "regulatoryMarks": ["AGMARK"],
    "certifications": [],
    "mfgLicenseNo": null,
    "dangerWarnings": null,
    "usageInstructions": "Wash and soak for 30 minutes before cooking",
    "ingredients": "Toor dal (split pigeon peas)",
    "nutritionalInfo": {"energy":"343kcal","protein":"22g","fat":"1.7g","carbs":"63g","fiber":"5g"},
    "allergens": [],
    "servingSize": "50g",
    "shelfLifeDays": 365,
    "storageInstructions": "Store in a cool, dry place in an airtight container",
    "manufacturerName": null,
    "countryOfOrigin": "India",
    "textureHint": "Small flat split yellow lentils with rough irregular edges, not round or spherical",
    "tags": ["dal", "pulses", "protein", "staple"],
    "variants": [
      { "name": "500g", "sku": "GRO-TOOR-DAL-500G", "barcode": "8901234560010", "unitType": "GRAM", "unitValue": 500, "mrp": 75.00, "packType": "pouch" },
      { "name": "1kg", "sku": "GRO-TOOR-DAL-1KG", "barcode": "8901234560027", "unitType": "KG", "unitValue": 1, "mrp": 145.00, "packType": "pouch" },
      { "name": "5kg", "sku": "GRO-TOOR-DAL-5KG", "barcode": "8901234560034", "unitType": "KG", "unitValue": 5, "mrp": 690.00, "packType": "bag" }
    ]
  }
]

Rules:
- Generate exactly 50 products — all must be UNBRANDED grocery staples, no duplicates
- NO brand names — brand must be null for every product
- manufacturerName must be null
- Focus on: dals/lentils, rice, flour/atta, whole spices, sugar, salt, etc.
- categoryPath uses " > " separator for nesting (e.g. "Grocery > Pulses & Lentils", "Grocery > Grains > Rice")
- productType should be GROCERY for all items
- unitType must be one of: KG, GRAM, LITER, ML, PIECE, PACK, DOZEN, BUNDLE
- storageType must be one of: AMBIENT, REFRIGERATED, DEEP_CHILLED, FROZEN, COOL_DRY, HUMIDITY_CONTROLLED
- foodType must be one of: VEG, NON_VEG, VEGAN, EGG
- SKU must be unique across all products/variants, format: GRO-{PRODUCT}-{SIZE}
- barcode should be a realistic 13-digit EAN-13 barcode, unique per variant
- mrp is the Maximum Retail Price in INR (use realistic Indian market prices)
- hsnCode is the HSN/SAC code used for Indian GST
- gstPercent: most grocery staples are 0% or 5% GST
- Each product must have 2-3 size variants (e.g. 500g, 1kg, 5kg)
- textureHint is a short visual description of what the product actually looks like physically (shape, color, texture) — this will be used in image generation prompts so be very accurate and specific. Examples: "long slender white rice grains", "fine pale brown powder", "small flat split yellow lentils with rough irregular edges"
- All fields shown in the example are required (use null/[] where not applicable)`;

// ── Step 1: Cleanup ──────────────────────────────────────────

async function cleanup() {
  console.log("Cleaning up existing seeded data...");

  // Respect FK constraints: OrderItems → StoreProducts → Products → Categories → Brands
  const orderItemCount = await prisma.orderItem.deleteMany({});
  console.log(`  Deleted ${orderItemCount.count} order items`);

  const storeProductCount = await prisma.storeProduct.deleteMany({});
  console.log(`  Deleted ${storeProductCount.count} store products`);

  // Products cascade-deletes variants
  const productCount = await prisma.product.deleteMany({});
  console.log(`  Deleted ${productCount.count} products`);

  // Delete categories leaf-first (children before parents)
  const allCategories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  // Build a set of ids that are parents
  const parentIds = new Set(
    allCategories.filter((c) => c.parentId).map((c) => c.parentId!)
  );
  // Sort: leaves first (those whose id is NOT in parentIds), then parents
  const leaves = allCategories.filter((c) => !parentIds.has(c.id));
  const parents = allCategories.filter((c) => parentIds.has(c.id));

  // Delete leaves, then remaining (may need multiple passes for deep trees)
  let remaining = [...leaves, ...parents];
  while (remaining.length > 0) {
    const ids = remaining.map((c) => c.id);
    try {
      await prisma.category.deleteMany({ where: { id: { in: ids } } });
      break;
    } catch {
      // If FK error, delete one by one, skip failures
      const next: typeof remaining = [];
      for (const cat of remaining) {
        try {
          await prisma.category.delete({ where: { id: cat.id } });
        } catch {
          next.push(cat);
        }
      }
      if (next.length === remaining.length) {
        // No progress — force delete remaining
        await prisma.category.deleteMany({ where: { id: { in: next.map((c) => c.id) } } });
        break;
      }
      remaining = next;
    }
  }
  console.log(`  Deleted ${allCategories.length} categories`);

  const brandCount = await prisma.brand.deleteMany({});
  console.log(`  Deleted ${brandCount.count} brands`);

  console.log("Cleanup complete.\n");
}

// ── Step 2: Generate product data via Claude ─────────────────

async function generateProductData(): Promise<ProductData[]> {
  console.log("Calling Claude API to generate 50 products...");

  let fullText = "";
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 32000,
    messages: [{ role: "user", content: CLAUDE_PROMPT }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
    }
  }

  // Strip markdown code fences if present (```json ... ```)
  let raw = fullText.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const products: ProductData[] = JSON.parse(raw);
  console.log(`Received ${products.length} products from Claude.\n`);
  return products;
}

// ── Step 3: Generate image via DALL-E 3 & upload to S3 ───────

async function generateAndUploadImage(
  productName: string,
  slug: string,
  textureHint: string
): Promise<string | null> {
  try {
    console.log(`  Generating image for "${productName}"...`);

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Create a hyper-realistic product showcase image.

Main Subject:
${productName} placed in an attractive rustic wooden bowl.
The product looks like: ${textureHint}
Some of the product is naturally spilled outside the bowl for realism.

Background:
Completely transparent background (PNG with full alpha transparency).
No shadows outside object boundaries.
No floor, no backdrop, no gradient.

Composition:
• Light colored Wooden bowl in front, slightly angled
• Small natural spill in foreground
• A simple transparent plastic bag of the same product placed behind the bowl
• Bag is fully filled to the top with product, no empty space inside
• Top of bag is closed with a single flat heat-seal crimp — just one thin sealed line
• IMPORTANT: No ziplock, no zip strip, no resealable closure, no ridges, no grooves at the top
• Product is clearly visible through the transparent plastic
• No brand names, no labels, no text, no stickers on the bag
• Clean studio lighting
• Soft natural shadows only under objects
• Sharp focus, ultra detailed texture

Style:
Photorealistic product photography
E-commerce ready
High resolution
Square aspect ratio`,
      n: 1,
      size: "1024x1024",
      quality: "low",
      background: "transparent",
    });

    const b64 = response.data[0]?.b64_json;
    if (!b64) {
      console.warn(`  Warning: No image data returned for "${productName}"`);
      return null;
    }

    const buffer = Buffer.from(b64, "base64");
    const filename = `products/${slug}-${randomUUID()}.png`;
    const key = `${KEY_PREFIX}/${filename}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      })
    );

    const url = `${BASE_URL}/${filename}`;
    console.log(`  Uploaded: ${url}`);
    return url;
  } catch (err) {
    console.warn(
      `  Warning: Image generation failed for "${productName}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ── Step 4: Create brands ────────────────────────────────────

async function createBrands(
  products: ProductData[]
): Promise<Map<string, string>> {
  const brandNames = [...new Set(products.map((p) => p.brand).filter(Boolean))];
  const brandMap = new Map<string, string>();

  console.log(`Creating ${brandNames.length} brands...`);
  for (const name of brandNames) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    brandMap.set(name, brand.id);
  }
  console.log("");
  return brandMap;
}

// ── Step 5: Create categories ────────────────────────────────

async function createCategories(
  products: ProductData[]
): Promise<Map<string, string>> {
  const categoryPaths = new Set<string>();
  for (const p of products) {
    const parts = p.categoryPath.split(" > ");
    for (let i = 1; i <= parts.length; i++) {
      categoryPaths.add(parts.slice(0, i).join(" > "));
    }
  }

  const sortedPaths = Array.from(categoryPaths).sort();
  const categoryMap = new Map<string, string>();

  console.log(`Creating ${sortedPaths.length} categories...`);
  for (const path of sortedPaths) {
    const parts = path.split(" > ");
    const name = parts[parts.length - 1];
    const slug = slugify(path.replace(/ > /g, "-"));
    const parentPath =
      parts.length > 1 ? parts.slice(0, -1).join(" > ") : null;
    const parentId = parentPath ? categoryMap.get(parentPath) ?? null : null;

    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, parentId },
      create: { name, slug, parentId, sortOrder: 0 },
    });
    categoryMap.set(path, category.id);
  }
  console.log("");
  return categoryMap;
}

// ── Step 6: Create products with images ──────────────────────

async function createProducts(
  products: ProductData[],
  brandMap: Map<string, string>,
  categoryMap: Map<string, string>
): Promise<{ productCount: number; variantCount: number }> {
  const validUnitTypes = Object.values(UnitType);
  const validFoodTypes = Object.values(FoodType);
  const validProductTypes = Object.values(ProductType);
  const validStorageTypes = Object.values(StorageType);

  let productCount = 0;
  let variantCount = 0;

  console.log("Creating products with images...\n");

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const slug = slugify(p.name);
    const categoryId = categoryMap.get(p.categoryPath) ?? null;
    const brandId = p.brand ? brandMap.get(p.brand) ?? null : null;

    console.log(`[${i + 1}/${products.length}] ${p.name}`);

    // Generate and upload image
    const imageUrl = await generateAndUploadImage(p.name, slug, p.textureHint ?? p.name);

    // Create product + variants
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        categoryId,
        brandId,
        organizationId: null, // master catalog
        hsnCode: p.hsnCode ?? null,
        gstPercent: p.gstPercent ?? null,
        foodType:
          p.foodType && validFoodTypes.includes(p.foodType as FoodType)
            ? (p.foodType as FoodType)
            : null,
        productType:
          p.productType &&
          validProductTypes.includes(p.productType as ProductType)
            ? (p.productType as ProductType)
            : null,
        storageType:
          p.storageType &&
          validStorageTypes.includes(p.storageType as StorageType)
            ? (p.storageType as StorageType)
            : null,
        fssaiLicense: p.fssaiLicense ?? null,
        regulatoryMarks: p.regulatoryMarks ?? [],
        certifications: p.certifications ?? [],
        mfgLicenseNo: p.mfgLicenseNo ?? null,
        dangerWarnings: p.dangerWarnings ?? null,
        usageInstructions: p.usageInstructions ?? null,
        ingredients: p.ingredients ?? null,
        nutritionalInfo: p.nutritionalInfo ?? undefined,
        allergens: p.allergens ?? [],
        servingSize: p.servingSize ?? null,
        shelfLifeDays: p.shelfLifeDays ?? null,
        storageInstructions: p.storageInstructions ?? null,
        manufacturerName: p.manufacturerName ?? null,
        countryOfOrigin: p.countryOfOrigin ?? null,
        tags: p.tags ?? [],
        variants: {
          create: p.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            barcode: v.barcode ?? null,
            unitType: validUnitTypes.includes(v.unitType as UnitType)
              ? (v.unitType as UnitType)
              : "PIECE",
            unitValue: v.unitValue,
            mrp: v.mrp ?? null,
            packType: v.packType ?? null,
          })),
        },
      },
    });

    productCount++;
    variantCount += p.variants.length;

    // Rate limit: DALL-E 3 allows ~5 req/min, 15s between calls
    if (i < products.length - 1) {
      console.log("  Waiting 15s (rate limit)...\n");
      await sleep(15_000);
    }
  }

  return { productCount, variantCount };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("=== Master Catalog Seed (Trial: 50 Products) ===\n");

  await cleanup();

  const products = await generateProductData();

  const brandMap = await createBrands(products);
  const categoryMap = await createCategories(products);

  const { productCount, variantCount } = await createProducts(
    products,
    brandMap,
    categoryMap
  );

  console.log("\n=== Summary ===");
  console.log(`Products created:   ${productCount}`);
  console.log(`Variants created:   ${variantCount}`);
  console.log(`Categories created: ${categoryMap.size}`);
  console.log(`Brands created:     ${brandMap.size}`);
  console.log("\nDone!");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
