/**
 * Seed branded master products from prisma/data/branded-catalog-south.csv.
 * Creates missing brands (matched by name, then slug) and subcategories, then upserts products by name + brand
 * (master tier: organizationId = null) with their pack-size variants. Existing products only get variants topped up.
 * No MRP and no images — both must come from real packs. Not listed in any store; stores add them with their prices.
 * Rows marked verify=y are skipped unless --include-unverified is passed.
 *
 * Run: cd apps/api && npx tsx prisma/seed-branded-catalog.ts [--include-unverified]
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient, FoodType } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PRODUCT_TYPE, parseSize, resolveSubcategory, slugify, type TaxonomyPath } from "./lib/catalog.js";

dotenv.config();

const prisma = new PrismaClient();
const CSV_PATH = new URL("./data/branded-catalog-south.csv", import.meta.url);
const INCLUDE_UNVERIFIED = process.argv.includes("--include-unverified");

type Row = Record<string, string>;

// Minimal RFC 4180 reader: quoted fields may contain commas and doubled quotes
function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += ch;
    }
    return [...cells, cell];
  });
  const [header, ...body] = lines;
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]?.trim() ?? ""])));
}

const brandIds = new Map<string, string>();

async function resolveBrand(name: string): Promise<{ id: string; created: boolean }> {
  const cached = brandIds.get(name);
  if (cached) return { id: cached, created: false };
  const slug = slugify(name);
  const existing = await prisma.brand.findFirst({ where: { OR: [{ name }, { slug }] } });
  const brand = existing ?? await prisma.brand.create({ data: { name, slug } });
  brandIds.set(name, brand.id);
  return { id: brand.id, created: !existing };
}

async function upsertProduct(row: Row, brandId: string, subcategoryId: string): Promise<"created" | "existing"> {
  const variants = row.pack_sizes.split("|").map((name) => ({ name, ...parseSize(name) }));
  const existing = await prisma.product.findFirst({
    where: { name: row.product, brandId, organizationId: null },
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
      name: row.product,
      brandId,
      subcategoryId,
      manufacturerName: row.manufacturer || null,
      productType: PRODUCT_TYPE[row.department],
      foodType: (row.food_type || null) as FoodType | null,
      variants: { create: variants },
    },
  });
  return "created";
}

async function main() {
  console.log(`Seeding branded catalog into ${new URL(process.env.DATABASE_URL!).host}`);
  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const todo = rows.filter((r) => INCLUDE_UNVERIFIED || r.verify !== "y");
  const counts = { brands: 0, subcategories: 0, created: 0, existing: 0 };

  for (const row of todo) {
    const path: TaxonomyPath = [row.department, row.category, row.subcategory];
    const sub = await resolveSubcategory(prisma, path);
    if (sub.created) { counts.subcategories++; console.log(`+ subcategory: ${path.join(" > ")}`); }
    const brand = await resolveBrand(row.brand);
    if (brand.created) counts.brands++;
    counts[await upsertProduct(row, brand.id, sub.id)]++;
  }
  console.log(`✔ ${counts.brands} brands and ${counts.subcategories} subcategories created; ` +
    `${counts.created} products created, ${counts.existing} already present`);
  console.log(`  ${rows.length - todo.length} rows marked verify skipped${INCLUDE_UNVERIFIED ? "" : " (pass --include-unverified to seed them)"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
