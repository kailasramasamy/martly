/**
 * Loads the reviewed search-intent data (see generate-search-intents.ts) into subcategories and brands, and each
 * region's brand popularity (brand-popularity-regions.json) into brand_region_popularity.
 *
 *   cd apps/api && npx tsx prisma/seed-search-intents.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const terms = JSON.parse(readFileSync("prisma/data/subcategory-search-terms.json", "utf8")) as Record<string, string[]>;
const popularity = JSON.parse(readFileSync("prisma/data/brand-popularity.json", "utf8")) as Record<string, number>;
// Region code → brand slug → popularity there; a brand without a row for a region uses its national score
const regional = JSON.parse(readFileSync("prisma/data/brand-popularity-regions.json", "utf8")) as Record<string, Record<string, number>>;

const subcategoryUpdates = Object.entries(terms).map(([slug, searchTerms]) =>
  prisma.subcategory.updateMany({ where: { slug }, data: { searchTerms } }));
const brandUpdates = Object.entries(popularity).map(([slug, score]) =>
  prisma.brand.updateMany({ where: { slug }, data: { popularity: score } }));

const results = await prisma.$transaction([...subcategoryUpdates, ...brandUpdates]);
const updated = (from: number, to: number) => results.slice(from, to).reduce((n, r) => n + r.count, 0);
console.log(`Subcategories: ${updated(0, subcategoryUpdates.length)}/${subcategoryUpdates.length}`);
console.log(`Brands: ${updated(subcategoryUpdates.length, results.length)}/${brandUpdates.length}`);

// Each region's rows become exactly what the file lists
const brandIds = new Map((await prisma.brand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]));
for (const [region, scores] of Object.entries(regional)) {
  const rows = Object.entries(scores).flatMap(([slug, score]) => {
    const brandId = brandIds.get(slug);
    return brandId ? [{ brandId, region, popularity: score }] : [];
  });
  await prisma.$transaction([
    prisma.brandRegionPopularity.deleteMany({ where: { region } }),
    prisma.brandRegionPopularity.createMany({ data: rows }),
  ]);
  console.log(`${region}: ${rows.length}/${Object.keys(scores).length} brands`);
}
await prisma.$disconnect();
