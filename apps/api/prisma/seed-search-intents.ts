/**
 * Loads the reviewed search-intent data (see generate-search-intents.ts) into subcategories and brands.
 *
 *   cd apps/api && npx tsx prisma/seed-search-intents.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const terms = JSON.parse(readFileSync("prisma/data/subcategory-search-terms.json", "utf8")) as Record<string, string[]>;
const popularity = JSON.parse(readFileSync("prisma/data/brand-popularity.json", "utf8")) as Record<string, number>;

const subcategoryUpdates = Object.entries(terms).map(([slug, searchTerms]) =>
  prisma.subcategory.updateMany({ where: { slug }, data: { searchTerms } }));
const brandUpdates = Object.entries(popularity).map(([slug, score]) =>
  prisma.brand.updateMany({ where: { slug }, data: { popularity: score } }));

const results = await prisma.$transaction([...subcategoryUpdates, ...brandUpdates]);
const updated = (from: number, to: number) => results.slice(from, to).reduce((n, r) => n + r.count, 0);
console.log(`Subcategories: ${updated(0, subcategoryUpdates.length)}/${subcategoryUpdates.length}`);
console.log(`Brands: ${updated(subcategoryUpdates.length, results.length)}/${brandUpdates.length}`);
await prisma.$disconnect();
