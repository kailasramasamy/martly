/**
 * Seed the generic (unbranded) master catalog: loose staples, produce, fresh meat, local snacks, pooja items.
 * Data: prisma/data/generic-catalog/*.json — each group is a [department, category, subcategory] path + items.
 * Creates any missing subcategory under the existing category, then upserts products by name
 * (master tier: organizationId = null, brandId = null) with Tamil names and pack-size variants.
 * No MRP — every store sets its own price. Idempotent: existing products only get their variants topped up.
 *
 * Run: cd apps/api && npx tsx prisma/seed-generic-catalog.ts
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient, FoodType } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { PRODUCT_TYPE, parseSize, resolveSubcategory, type TaxonomyPath } from "./lib/catalog.js";

dotenv.config();

const prisma = new PrismaClient();
const DATA_DIR = new URL("./data/generic-catalog/", import.meta.url);

interface Item { name: string; ta: string; subject: string; sizes?: string[]; foodType?: FoodType }
interface Group { path: TaxonomyPath; sizes: string[]; items: Item[] }

function foodTypeFor(path: Group["path"], item: Item): FoodType {
  if (item.foodType) return item.foodType;
  if (path[0] !== "Meat, Fish & Eggs") return "VEG";
  return path[1] === "Eggs" ? "EGG" : "NON_VEG";
}

function loadGroups(): Group[] {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(new URL(f, DATA_DIR), "utf8")) as Group[]);
}

async function upsertProduct(group: Group, subcategoryId: string, item: Item): Promise<"created" | "existing"> {
  const sizes = item.sizes ?? group.sizes;
  const variants = sizes.map((name) => ({ name, ...parseSize(name) }));
  const existing = await prisma.product.findFirst({
    where: { name: item.name, organizationId: null, brandId: null },
    include: { variants: { select: { name: true } } },
  });

  if (existing) {
    const have = new Set(existing.variants.map((v) => v.name));
    const missing = variants.filter((v) => !have.has(v.name));
    if (missing.length) {
      await prisma.productVariant.createMany({ data: missing.map((v) => ({ ...v, productId: existing.id })) });
    }
    return "existing";
  }

  await prisma.product.create({
    data: {
      name: item.name,
      subcategoryId,
      productType: PRODUCT_TYPE[group.path[0]],
      foodType: foodTypeFor(group.path, item),
      tags: ["generic"],
      translations: { ta: { name: item.ta } },
      variants: { create: variants },
    },
  });
  return "created";
}

async function main() {
  const groups = loadGroups();
  const counts = { subcategories: 0, created: 0, existing: 0 };
  for (const group of groups) {
    const sub = await resolveSubcategory(prisma, group.path);
    if (sub.created) {
      counts.subcategories++;
      console.log(`+ subcategory: ${group.path.join(" > ")}`);
    }
    for (const item of group.items) counts[await upsertProduct(group, sub.id, item)]++;
  }
  console.log(`✔ ${counts.subcategories} subcategories created, ${counts.created} products created, ${counts.existing} already present`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
