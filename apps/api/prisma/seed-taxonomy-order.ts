/**
 * Apply the buying-frequency order in prisma/data/taxonomy-order.json to departments, categories and subcategories.
 * The file lists every department > category > subcategory in display order. sortOrder is numbered sequentially
 * across the whole tree, so flat listings follow the same order as the nested ones.
 * Aborts without writing if the file and the database disagree on any node.
 *
 * Run: cd apps/api && npx tsx prisma/seed-taxonomy-order.ts
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config();

const prisma = new PrismaClient();
type Order = Record<string, Record<string, string[]>>;
const ORDER: Order = JSON.parse(readFileSync(new URL("./data/taxonomy-order.json", import.meta.url), "utf8"));

// Paths as "dept", "dept > cat", "dept > cat > sub" so both sides can be compared as sets
function filePaths(): string[] {
  return Object.entries(ORDER).flatMap(([dept, cats]) => [
    dept,
    ...Object.entries(cats).flatMap(([cat, subs]) => [`${dept} > ${cat}`, ...subs.map((sub) => `${dept} > ${cat} > ${sub}`)]),
  ]);
}

async function main() {
  console.log(`Ordering taxonomy in ${new URL(process.env.DATABASE_URL!).host}`);
  const departments = await prisma.department.findMany({
    include: { categories: { include: { subcategories: true } } },
  });
  const dbIds = new Map<string, { level: "dept" | "cat" | "sub"; id: string }>();
  for (const d of departments) {
    dbIds.set(d.name, { level: "dept", id: d.id });
    for (const c of d.categories) {
      dbIds.set(`${d.name} > ${c.name}`, { level: "cat", id: c.id });
      for (const s of c.subcategories) dbIds.set(`${d.name} > ${c.name} > ${s.name}`, { level: "sub", id: s.id });
    }
  }

  const paths = filePaths();
  const notInDb = paths.filter((p) => !dbIds.has(p));
  const notInFile = [...dbIds.keys()].filter((p) => !paths.includes(p));
  if (notInDb.length || notInFile.length) {
    throw new Error(`Order file out of sync.\n  Not in DB: ${notInDb.join("; ") || "-"}\n  Not in file: ${notInFile.join("; ") || "-"}`);
  }

  const counters = { dept: 0, cat: 0, sub: 0 };
  const updates = paths.map((path) => {
    const { level, id } = dbIds.get(path)!;
    const data = { sortOrder: counters[level]++ };
    if (level === "dept") return prisma.department.update({ where: { id }, data });
    if (level === "cat") return prisma.category.update({ where: { id }, data });
    return prisma.subcategory.update({ where: { id }, data });
  });
  await prisma.$transaction(updates);
  console.log(`✔ ${counters.dept} departments, ${counters.cat} categories, ${counters.sub} subcategories reordered`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
