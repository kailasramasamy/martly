/**
 * Seed script: 3-tier taxonomy + real product catalog
 * - Cleans S3 martly/products/ prefix
 * - Wipes all transactional + catalog data
 * - Imports 16 departments, 87 categories, 447 subcategories
 * - Imports 485 brands, 1367 products, 2358 variants
 * - Uploads ~7K product images to S3
 * - Maps all variants to Bigmart store
 *
 * Usage: cd apps/api && npx tsx prisma/seed-new-catalog.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const CATALOG_PATH = "/Users/vaidehi/Projects/grocery-fmcg-catalog/catalog.json";
const IMAGES_BASE = "/Users/vaidehi/Projects/grocery-fmcg-catalog/images";
// Will be resolved at runtime from the database
let STORE_ID = "";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? "media-image-upload";
const KEY_PREFIX = process.env.S3_KEY_PREFIX ?? "martly";
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL ?? `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com/${KEY_PREFIX}`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  return map[ext.toLowerCase()] ?? "image/jpeg";
}

// ── Step 1: S3 Cleanup ──────────────────────────────
async function cleanS3Products() {
  console.log("🗑️  Cleaning S3 martly/products/ prefix...");
  const prefix = `${KEY_PREFIX}/products/`;
  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));

    const objects = listResult.Contents ?? [];
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key! })) },
      }));
      totalDeleted += objects.length;
    }

    continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`   Deleted ${totalDeleted} objects from S3`);
}

// ── Step 2: Data Wipe ───────────────────────────────
async function wipeData() {
  console.log("🧹 Wiping transactional + catalog data...");

  // Layer 1: order-related
  await prisma.orderStatusLog.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.storeRating.deleteMany();
  await prisma.returnRequestItem.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  // Layer 2: product-related
  await prisma.recipeItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.reviewImage.deleteMany();
  await prisma.reviewReply.deleteMany();
  await prisma.review.deleteMany();
  await prisma.searchAlias.deleteMany();
  await prisma.collectionItem.deleteMany();
  await prisma.storeProduct.deleteMany();

  // Layer 3: subscriptions
  await prisma.subscriptionItemOverride.deleteMany();
  await prisma.subscriptionItem.deleteMany();
  await prisma.subscriptionSkip.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.basketAddOn.deleteMany();

  // Layer 4: collections, coupons
  await prisma.collection.deleteMany();
  await prisma.coupon.deleteMany();

  // Layer 5: products + variants
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();

  // Layer 6: taxonomy
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.department.deleteMany();

  // Layer 7: brands
  await prisma.brand.deleteMany();

  // Layer 8: other
  await prisma.recipe.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.deliveryTrip.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationCampaign.deleteMany();

  console.log("   Data wiped successfully");
}

// ── Step 3: Import Taxonomy ─────────────────────────
interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  brand: string;
  department: string;
  category: string;
  subcategory: string;
  type: string | null;
  description: string;
  variants: {
    sku: string;
    weight: string;
    mrp: number;
    barcode: string;
    images: string[];
  }[];
}

async function importTaxonomy(products: CatalogProduct[]) {
  console.log("📂 Importing taxonomy...");

  // Extract unique departments, categories, subcategories
  const deptSet = new Set<string>();
  const catSet = new Map<string, string>(); // "cat name" → dept name
  const subcatSet = new Map<string, string>(); // "subcat name" → cat name

  for (const p of products) {
    deptSet.add(p.department);
    catSet.set(p.category, p.department);
    subcatSet.set(`${p.category}::${p.subcategory}`, p.category);
  }

  // Create departments
  const deptNames = [...deptSet].sort();
  const deptMap = new Map<string, string>(); // name → id
  for (let i = 0; i < deptNames.length; i++) {
    const dept = await prisma.department.create({
      data: { name: deptNames[i], slug: slugify(deptNames[i]), sortOrder: i },
    });
    deptMap.set(deptNames[i], dept.id);
  }
  console.log(`   ${deptMap.size} departments created`);

  // Create categories
  const catNames = [...new Set(catSet.keys())].sort();
  const catMap = new Map<string, string>(); // name → id
  for (let i = 0; i < catNames.length; i++) {
    const deptName = catSet.get(catNames[i])!;
    const cat = await prisma.category.create({
      data: {
        name: catNames[i],
        slug: slugify(catNames[i]),
        departmentId: deptMap.get(deptName)!,
        sortOrder: i,
      },
    });
    catMap.set(catNames[i], cat.id);
  }
  console.log(`   ${catMap.size} categories created`);

  // Create subcategories
  const subcatEntries = [...subcatSet.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const subcatMap = new Map<string, string>(); // "cat::subcat" → id
  for (let i = 0; i < subcatEntries.length; i++) {
    const [key, catName] = subcatEntries[i];
    const subcatName = key.split("::")[1];
    const sub = await prisma.subcategory.create({
      data: {
        name: subcatName,
        slug: slugify(`${catName}-${subcatName}`),
        categoryId: catMap.get(catName)!,
        sortOrder: i,
      },
    });
    subcatMap.set(key, sub.id);
  }
  console.log(`   ${subcatMap.size} subcategories created`);

  return { deptMap, catMap, subcatMap };
}

// ── Step 4: Import Brands ───────────────────────────
async function importBrands(products: CatalogProduct[]) {
  console.log("🏷️  Importing brands...");
  const brandNames = [...new Set(products.map((p) => p.brand))].sort();
  const brandMap = new Map<string, string>();

  // Batch create brands
  for (const name of brandNames) {
    const brand = await prisma.brand.create({
      data: { name, slug: slugify(name) },
    });
    brandMap.set(name, brand.id);
  }
  console.log(`   ${brandMap.size} brands created`);
  return brandMap;
}

// ── Step 5: Upload Images to S3 ─────────────────────
async function uploadImages(products: CatalogProduct[]) {
  console.log("📸 Uploading images to S3...");

  // Collect all image files
  const uploads: { localPath: string; s3Key: string }[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      for (const imgPath of v.images) {
        const localPath = path.join(IMAGES_BASE, "..", imgPath);
        // S3 key: martly/catalog/<slug>/<weight>/<filename>
        const s3Key = `${KEY_PREFIX}/catalog/${p.slug}/${v.weight}/${path.basename(imgPath)}`;
        uploads.push({ localPath, s3Key });
      }
    }
  }

  console.log(`   ${uploads.length} images to upload`);

  // Upload with concurrency limit
  const CONCURRENCY = 50;
  let uploaded = 0;
  let failed = 0;

  async function uploadOne(item: { localPath: string; s3Key: string }) {
    try {
      const body = fs.readFileSync(item.localPath);
      const ext = path.extname(item.localPath);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: item.s3Key,
        Body: body,
        ContentType: getMimeType(ext),
      }));
      uploaded++;
    } catch {
      failed++;
    }
    if ((uploaded + failed) % 200 === 0) {
      console.log(`   Progress: ${uploaded + failed}/${uploads.length} (${failed} failed)`);
    }
  }

  // Process in batches
  for (let i = 0; i < uploads.length; i += CONCURRENCY) {
    const batch = uploads.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(uploadOne));
  }

  console.log(`   Upload complete: ${uploaded} succeeded, ${failed} failed`);

  // Return a map from local image path → S3 URL
  const urlMap = new Map<string, string>();
  for (const item of uploads) {
    urlMap.set(item.localPath, `${BASE_URL.replace(`/${KEY_PREFIX}`, "")}/${item.s3Key}`);
  }
  return urlMap;
}

// ── Step 6: Import Products + Variants ──────────────
async function importProducts(
  products: CatalogProduct[],
  subcatMap: Map<string, string>,
  brandMap: Map<string, string>,
  imageUrlMap: Map<string, string>,
) {
  console.log("📦 Importing products + variants...");

  let productCount = 0;
  let variantCount = 0;
  const BATCH = 50;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);

    for (const p of batch) {
      const subcatKey = `${p.category}::${p.subcategory}`;
      const subcategoryId = subcatMap.get(subcatKey);
      const brandId = brandMap.get(p.brand);

      // Product image = first variant's first image
      const firstImage = p.variants[0]?.images[0];
      const productImageUrl = firstImage
        ? imageUrlMap.get(path.join(IMAGES_BASE, "..", firstImage)) ?? null
        : null;

      // Collect all product images
      const allImages: string[] = [];
      for (const v of p.variants) {
        for (const img of v.images) {
          const url = imageUrlMap.get(path.join(IMAGES_BASE, "..", img));
          if (url) allImages.push(url);
        }
      }

      const product = await prisma.product.create({
        data: {
          name: p.name,
          description: p.description || null,
          imageUrl: productImageUrl,
          images: allImages,
          subcategoryId,
          brandId,
          isActive: true,
          variants: {
            create: p.variants.map((v) => {
              const variantImageUrl = v.images[0]
                ? imageUrlMap.get(path.join(IMAGES_BASE, "..", v.images[0])) ?? null
                : null;
              return {
                name: v.weight,
                sku: v.sku || null,
                barcode: v.barcode || null,
                unitType: "PIECE" as const,
                unitValue: 1,
                mrp: v.mrp,
                imageUrl: variantImageUrl,
              };
            }),
          },
        },
        include: { variants: true },
      });

      productCount++;
      variantCount += product.variants.length;
    }

    if ((i + BATCH) % 200 < BATCH) {
      console.log(`   Progress: ${Math.min(i + BATCH, products.length)}/${products.length} products`);
    }
  }

  console.log(`   ${productCount} products, ${variantCount} variants created`);
}

// ── Step 7: Store Product Mapping ───────────────────
async function mapToStore() {
  // Find the first store in the database
  const store = await prisma.store.findFirst({ select: { id: true, name: true } });
  if (!store) {
    console.log("   No store found — skipping store mapping. Run base seed first.");
    return;
  }
  STORE_ID = store.id;
  console.log(`🏪 Mapping all variants to ${store.name}...`);

  const variants = await prisma.productVariant.findMany({
    select: { id: true, productId: true, mrp: true },
  });

  const BATCH = 500;
  let created = 0;

  for (let i = 0; i < variants.length; i += BATCH) {
    const batch = variants.slice(i, i + BATCH);
    await prisma.storeProduct.createMany({
      data: batch.map((v) => ({
        storeId: STORE_ID,
        productId: v.productId,
        variantId: v.id,
        price: v.mrp ?? 0,
        stock: Math.floor(Math.random() * 91) + 10, // 10-100
        isFeatured: Math.random() < 0.15,
      })),
    });
    created += batch.length;
  }

  console.log(`   ${created} store products created`);
}

// ── Main ────────────────────────────────────────────
async function main() {
  console.log("🚀 Starting catalog seed...\n");

  const catalogData = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  const products: CatalogProduct[] = catalogData.products;

  console.log(`   Catalog: ${products.length} products\n`);

  // Step 1: Clean S3
  await cleanS3Products();
  console.log();

  // Step 2: Wipe data
  await wipeData();
  console.log();

  // Step 3: Import taxonomy
  const { subcatMap } = await importTaxonomy(products);
  console.log();

  // Step 4: Import brands
  const brandMap = await importBrands(products);
  console.log();

  // Step 5: Upload images
  const imageUrlMap = await uploadImages(products);
  console.log();

  // Step 6: Import products + variants
  await importProducts(products, subcatMap, brandMap, imageUrlMap);
  console.log();

  // Step 7: Map to store
  await mapToStore();
  console.log();

  console.log("✅ Catalog seed complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
