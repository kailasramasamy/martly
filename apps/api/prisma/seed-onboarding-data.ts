/**
 * Loads the reviewed onboarding data into brands (regions shoppers buy them in) and subcategories (aisle tier).
 * Store onboarding proposes a catalog from these; edit the JSON files and re-run to change it.
 *
 *   cd apps/api && npx tsx prisma/seed-onboarding-data.ts   (set TARGET_DATABASE_URL for another DB)
 */
import { readFileSync } from "node:fs";
import { PrismaClient, type SubcategoryTier } from "../generated/prisma/client.js";

const prisma = new PrismaClient({ datasourceUrl: process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL });

const regions = JSON.parse(readFileSync("prisma/data/brand-regions.json", "utf8")) as Record<string, string[]>;
const tiers = JSON.parse(readFileSync("prisma/data/subcategory-tiers.json", "utf8")) as Record<string, SubcategoryTier>;

const brandUpdates = Object.entries(regions).map(([slug, codes]) =>
  prisma.brand.updateMany({ where: { slug }, data: { regions: codes } }));
const tierUpdates = Object.entries(tiers).map(([slug, tier]) =>
  prisma.subcategory.updateMany({ where: { slug }, data: { tier } }));

const results = await prisma.$transaction([...brandUpdates, ...tierUpdates]);
const updated = (from: number, to: number) => results.slice(from, to).reduce((n, r) => n + r.count, 0);
console.log(`Brands: ${updated(0, brandUpdates.length)}/${brandUpdates.length}`);
console.log(`Subcategories: ${updated(brandUpdates.length, results.length)}/${tierUpdates.length}`);
await prisma.$disconnect();
