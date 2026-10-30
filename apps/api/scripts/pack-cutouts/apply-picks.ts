/**
 * Set each category's and department's chosen tile packs from prisma/data/category-packs.json and department-packs.json
 * ({ slug: [backId, frontId, …] }). A store's tile shows the first two of these it stocks; those not listed keep theirs.
 *
 * Usage: cd apps/api && npx tsx scripts/pack-cutouts/apply-picks.ts [--prod]
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { readFileSync } from "node:fs";
import { PrismaClient } from "../../generated/prisma/index.js";

const prod = process.argv.includes("--prod");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);
const read = (file: string) => Object.entries(JSON.parse(readFileSync(`prisma/data/${file}`, "utf8")) as Record<string, string[]>);

function report(kind: string, slugs: string[], counts: { count: number }[]) {
  const missing = slugs.filter((_, i) => counts[i].count === 0);
  console.log(`${prod ? "PROD" : "local"}: ${slugs.length - missing.length}/${slugs.length} ${kind}`, missing.length ? `missing: ${missing.join(", ")}` : "");
}

async function main() {
  const categories = read("category-packs.json");
  const departments = read("department-packs.json");
  const results = await prisma.$transaction([
    ...categories.map(([slug, packProductIds]) => prisma.category.updateMany({ where: { slug }, data: { packProductIds } })),
    ...departments.map(([slug, packProductIds]) => prisma.department.updateMany({ where: { slug }, data: { packProductIds } })),
  ]);
  report("categories", categories.map(([slug]) => slug), results.slice(0, categories.length));
  report("departments", departments.map(([slug]) => slug), results.slice(categories.length));
}

main().finally(() => prisma.$disconnect());
