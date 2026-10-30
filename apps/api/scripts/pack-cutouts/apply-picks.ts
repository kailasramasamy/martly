/**
 * Set each category's chosen tile packs from prisma/data/category-packs.json ({ categorySlug: [backId, frontId, …] }).
 * A store's tile shows the first two of these it stocks; categories not listed keep theirs.
 *
 * Usage: cd apps/api && npx tsx scripts/pack-cutouts/apply-picks.ts [--prod]
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { readFileSync } from "node:fs";
import { PrismaClient } from "../../generated/prisma/index.js";

const prod = process.argv.includes("--prod");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);
const picks = JSON.parse(readFileSync("prisma/data/category-packs.json", "utf8")) as Record<string, string[]>;

async function main() {
  const results = await prisma.$transaction(Object.entries(picks).map(([slug, packProductIds]) =>
    prisma.category.updateMany({ where: { slug }, data: { packProductIds } })));
  const missing = Object.keys(picks).filter((_, i) => results[i].count === 0);
  console.log(`${prod ? "PROD" : "local"}: ${results.length - missing.length}/${results.length} categories`, missing.length ? `missing: ${missing.join(", ")}` : "");
}

main().finally(() => prisma.$disconnect());
