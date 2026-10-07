/**
 * Tamil names for the current catalog: departments, categories, subcategories and fresh produce.
 * Packaged products keep their English (brand) names, as is standard for Indian grocery apps.
 * Data lives in prisma/data/translations-ta.json (English name → Tamil name), machine-assisted —
 * have a native speaker review before production; corrections can be made in the admin panel.
 *
 * Merges into the existing `translations` JSON, so other languages and existing Tamil
 * descriptions are kept. Skips rows whose Tamil name was already edited by an admin.
 * Run: cd apps/api && npx tsx prisma/seed-translations-ta.ts
 */

import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

type NameMap = Record<string, string>;
interface TranslationData {
  departments: NameMap;
  categories: NameMap;
  subcategories: NameMap;
  products: NameMap;
}

type Translations = Record<string, { name?: string; description?: string }>;
type Row = { id: string; name: string; translations: Prisma.JsonValue };
type Model = "department" | "category" | "subcategory" | "product";

const data: TranslationData = JSON.parse(
  readFileSync(new URL("./data/translations-ta.json", import.meta.url), "utf8"),
);

async function findRows(model: Model, names: string[]): Promise<Row[]> {
  const args = { where: { name: { in: names } }, select: { id: true, name: true, translations: true } };
  switch (model) {
    case "department": return prisma.department.findMany(args);
    case "category": return prisma.category.findMany(args);
    case "subcategory": return prisma.subcategory.findMany(args);
    case "product": return prisma.product.findMany(args);
  }
}

async function writeRow(model: Model, id: string, translations: Translations) {
  const args = { where: { id }, data: { translations } };
  switch (model) {
    case "department": return prisma.department.update(args);
    case "category": return prisma.category.update(args);
    case "subcategory": return prisma.subcategory.update(args);
    case "product": return prisma.product.update(args);
  }
}

async function apply(model: Model, names: NameMap): Promise<number> {
  const rows = await findRows(model, Object.keys(names));
  let updated = 0;
  for (const row of rows) {
    const existing = (row.translations ?? {}) as Translations;
    if (existing.ta?.name) continue;
    await writeRow(model, row.id, { ...existing, ta: { ...existing.ta, name: names[row.name] } });
    updated++;
  }
  return updated;
}

async function main() {
  const sections: [Model, NameMap][] = [
    ["department", data.departments],
    ["category", data.categories],
    ["subcategory", data.subcategories],
    ["product", data.products],
  ];
  for (const [model, names] of sections) {
    console.log(`✔ ${model}: ${await apply(model, names)} updated (${Object.keys(names).length} names in data)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
