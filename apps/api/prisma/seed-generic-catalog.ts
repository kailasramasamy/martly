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

import { PrismaClient, FoodType, ProductType, UnitType } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { readFileSync, readdirSync } from "node:fs";

dotenv.config();

const prisma = new PrismaClient();
const DATA_DIR = new URL("./data/generic-catalog/", import.meta.url);

interface Item { name: string; ta: string; subject: string; sizes?: string[]; foodType?: FoodType }
interface Group { path: [string, string, string]; sizes: string[]; items: Item[] }

const PRODUCT_TYPE: Record<string, ProductType> = {
  "Grocery & Staples": "GROCERY",
  "Gourmet & World Foods": "GROCERY",
  "Fruits & Vegetables": "FRESH_PRODUCE",
  "Meat, Fish & Eggs": "FRESH_PRODUCE",
  "Dairy": "DAIRY",
  "Beverages": "BEVERAGES",
  "Snacks & Packaged Foods": "SNACKS",
  "Bakery": "BAKERY",
  "Pooja & Festivals": "HOUSEHOLD",
  "Home Care": "HOUSEHOLD",
};

const UNITS: Record<string, UnitType> = {
  g: "GRAM", kg: "KG", ml: "ML", L: "LITER",
  pc: "PIECE", pcs: "PIECE", leaves: "PIECE", mulam: "PIECE", pack: "PACK", bunch: "BUNDLE",
};

function parseSize(size: string): { unitType: UnitType; unitValue: number } {
  const m = size.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
  const unitType = m && UNITS[m[2]];
  if (!m || !unitType) throw new Error(`Unrecognised pack size "${size}"`);
  return { unitType, unitValue: Number(m[1]) };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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

async function resolveSubcategory([dept, cat, sub]: Group["path"]): Promise<{ id: string; created: boolean }> {
  const category = await prisma.category.findFirst({ where: { name: cat, department: { name: dept } } });
  if (!category) throw new Error(`Category not found: ${dept} > ${cat}`);
  const existing = await prisma.subcategory.findFirst({ where: { name: sub, categoryId: category.id } });
  if (existing) return { id: existing.id, created: false };

  const last = await prisma.subcategory.aggregate({ where: { categoryId: category.id }, _max: { sortOrder: true } });
  const created = await prisma.subcategory.create({
    data: {
      name: sub,
      slug: `${category.slug}-${slugify(sub)}`,
      categoryId: category.id,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  return { id: created.id, created: true };
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
    const sub = await resolveSubcategory(group.path);
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
