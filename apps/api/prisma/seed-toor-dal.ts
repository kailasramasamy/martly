/**
 * Seed script: extra toor dal master products (with tags) + store listings
 * - Adds master products to the "Toor Dal (Arhar)" subcategory (idempotent by name)
 * - Tags the existing toor dal products
 * - Lists everything in Downtown Mart and every "Harur" store
 *
 * Usage: cd apps/api && npx tsx prisma/seed-toor-dal.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const DOWNTOWN_MART_ID = "5cb06e5d-10b9-40ad-b42b-e7e1e9dbccbf";
const SUBCATEGORY_NAME = "Toor Dal (Arhar)";
const IMAGE = "https://images.unsplash.com/photo-1612257416648-ee7a6c533b4f?w=600&h=600&fit=crop";

interface SeedProduct {
  name: string;
  brand: string;
  description: string;
  tags: string[];
  variants: { name: string; mrp: number }[];
  discountPercent?: number;
}

const PRODUCTS: SeedProduct[] = [
  {
    name: "24 Mantra Organic Toor Dal",
    brand: "24 Mantra Organic",
    description: "Certified organic unpolished toor dal, grown without synthetic pesticides or fertilisers.",
    tags: ["organic", "unpolished"],
    variants: [{ name: "500g", mrp: 118 }, { name: "1kg", mrp: 225 }],
    discountPercent: 15,
  },
  {
    name: "Pro Nature Organic Toor Dal",
    brand: "Pro Nature",
    description: "Organic arhar dal, naturally grown and carefully cleaned for everyday cooking.",
    tags: ["organic"],
    variants: [{ name: "500g", mrp: 112 }, { name: "1kg", mrp: 215 }],
  },
  {
    name: "Tata Sampann Toor Dal Premium",
    brand: "Tata Sampann",
    description: "Premium quality toor dal, hand-picked and machine sorted for uniform grain and quick cooking.",
    tags: ["premium"],
    variants: [{ name: "500g", mrp: 76 }, { name: "1kg", mrp: 144 }],
  },
  {
    name: "Whole Farm Pesticide Free Toor Dal",
    brand: "Whole Farm",
    description: "Pesticide free arhar dal sourced directly from farmers, with no polish or colour added.",
    tags: ["pesticide-free"],
    variants: [{ name: "500g", mrp: 105 }, { name: "1kg", mrp: 198 }],
    discountPercent: 10,
  },
  {
    name: "Fortune Premium Toor Dal",
    brand: "Fortune (Adani Wilmar)",
    description: "Premium grade arhar dal, sortex cleaned for consistent quality and rich taste.",
    tags: ["premium"],
    variants: [{ name: "1kg", mrp: 142 }],
  },
  {
    name: "Organic India Toor Dal",
    brand: "Organic India",
    description: "Organic unpolished toor dal with natural protein and a rich, earthy flavour.",
    tags: ["organic", "unpolished"],
    variants: [{ name: "500g", mrp: 125 }, { name: "1kg", mrp: 238 }],
    discountPercent: 25,
  },
  {
    name: "Akshayakalpa Organic Toor Dal",
    brand: "Akshayakalpa",
    description: "Farm-fresh organic toor dal from Karnataka farmers, free from chemical treatment.",
    tags: ["organic"],
    variants: [{ name: "500g", mrp: 115 }],
  },
  {
    name: "Patanjali Toor Dal Unpolished",
    brand: "Patanjali",
    description: "Unpolished arhar dal that retains its natural nutrients and traditional taste.",
    tags: ["unpolished"],
    variants: [{ name: "500g", mrp: 70 }, { name: "1kg", mrp: 132 }],
  },
];

const EXISTING_TAGS: Record<string, string[]> = {
  "Tata Sampann Unpolished Toor Dal": ["unpolished"],
  "Organic Tatva Toor Dal": ["organic"],
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function findOrCreateBrand(name: string): Promise<string> {
  const existing = await prisma.brand.findFirst({ where: { name } });
  if (existing) return existing.id;
  const brand = await prisma.brand.create({ data: { name, slug: slugify(name) } });
  return brand.id;
}

async function createProduct(seed: SeedProduct, subcategoryId: string) {
  const brandId = await findOrCreateBrand(seed.brand);
  return prisma.product.create({
    data: {
      name: seed.name,
      description: seed.description,
      imageUrl: IMAGE,
      images: [IMAGE],
      subcategoryId,
      brandId,
      isActive: true,
      tags: seed.tags,
      variants: {
        create: seed.variants.map((v) => ({
          name: v.name,
          unitType: "PIECE" as const,
          unitValue: 1,
          mrp: v.mrp,
        })),
      },
    },
    include: { variants: true },
  });
}

async function seedProducts(subcategoryId: string) {
  const products: { id: string; name: string; discountPercent?: number; variants: { id: string; mrp: unknown }[] }[] = [];
  for (const seed of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { name: seed.name, organizationId: null },
      include: { variants: true },
    });
    if (existing) {
      console.log(`   skip (exists): ${seed.name}`);
      products.push({ ...existing, discountPercent: seed.discountPercent });
      continue;
    }
    const created = await createProduct(seed, subcategoryId);
    console.log(`   created: ${seed.name} [${seed.tags.join(", ")}]`);
    products.push({ ...created, discountPercent: seed.discountPercent });
  }
  return products;
}

async function tagExisting() {
  for (const [name, tags] of Object.entries(EXISTING_TAGS)) {
    const res = await prisma.product.updateMany({ where: { name, organizationId: null }, data: { tags } });
    console.log(`   tagged ${res.count}: ${name} -> [${tags.join(", ")}]`);
  }
}

async function listInStores(
  products: Awaited<ReturnType<typeof seedProducts>>,
  stores: { id: string; name: string }[],
) {
  const start = new Date();
  const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  let rows = 0;
  for (const store of stores) {
    for (const product of products) {
      for (const variant of product.variants) {
        const price = Math.round(Number(variant.mrp) * 0.94);
        const discount = product.discountPercent
          ? { discountType: "PERCENTAGE" as const, discountValue: product.discountPercent, discountStart: start, discountEnd: end }
          : {};
        const data = { price, stock: 50 + Math.floor(Math.random() * 151), isActive: true, ...discount };
        await prisma.storeProduct.upsert({
          where: { storeId_variantId: { storeId: store.id, variantId: variant.id } },
          create: { storeId: store.id, productId: product.id, variantId: variant.id, ...data },
          update: data,
        });
        rows++;
      }
    }
  }
  console.log(`   ${rows} store_products upserted across ${stores.length} stores`);
}

async function main() {
  const subcategory = await prisma.subcategory.findFirstOrThrow({ where: { name: SUBCATEGORY_NAME } });
  console.log("Seeding toor dal products...");
  const products = await seedProducts(subcategory.id);
  await tagExisting();

  const stores = await prisma.store.findMany({
    where: { OR: [{ name: { contains: "Harur" } }, { id: DOWNTOWN_MART_ID }] },
    select: { id: true, name: true },
  });
  console.log(`Listing in: ${stores.map((s) => s.name).join(", ")}`);
  await listInStores(products, stores);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
