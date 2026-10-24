/**
 * Moves saved Home layouts to the 2026-10-24 order: the best-selling category cards, buy again, the department grid and
 * the hero banners right after the member shortcuts. The long aisle directory and the hand-picked Best Sellers row (and
 * its collection) are switched off, not deleted, as the cards and the grid replace them. Safe to rerun.
 * Run: npx tsx prisma/reorder-home-layout.ts   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const BEST_SELLERS_ID = "ddfbfb6c-70ca-4f1c-bf64-33f6a3a4b06d";
const MOVED = ["BESTSELLER_CATEGORIES", "BUY_AGAIN", "DEPARTMENT_GRID", "HERO_BANNERS"] as const;

async function reorder(organizationId: string) {
  await prisma.$transaction(async (tx) => {
    if (!(await tx.homeSection.findFirst({ where: { organizationId, type: "BESTSELLER_CATEGORIES" } }))) {
      await tx.homeSection.create({ data: { organizationId, type: "BESTSELLER_CATEGORIES", config: {} } });
    }
    await tx.homeSection.updateMany({
      where: { organizationId, OR: [{ type: "CATEGORY_DIRECTORY" }, { type: "PRODUCT_ROW", collectionId: BEST_SELLERS_ID }] },
      data: { isActive: false },
    });
    await tx.homeSection.updateMany({ where: { organizationId, type: "DEPARTMENT_GRID" }, data: { isActive: true } });
    // Switched off as a collection too, or the automatic collection rows would bring it back
    await tx.collection.updateMany({ where: { id: BEST_SELLERS_ID, organizationId }, data: { isActive: false } });
    const rows = await tx.homeSection.findMany({ where: { organizationId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    const moved = MOVED.flatMap((type) => rows.filter((r) => r.type === type));
    const rest = rows.filter((r) => !moved.includes(r));
    const anchor = rest.findIndex((r) => r.type === "MEMBER_CHIPS") + 1;
    const ordered = [...rest.slice(0, anchor), ...moved, ...rest.slice(anchor)];
    for (const [sortOrder, row] of ordered.entries()) {
      await tx.homeSection.update({ where: { id: row.id }, data: { sortOrder } });
    }
    console.log(`${organizationId}: ${ordered.filter((r) => r.isActive || moved.includes(r)).map((r) => r.title ?? r.type).join(" → ")}`);
  }, { timeout: 60_000 });
}

async function main() {
  const orgs = await prisma.homeSection.findMany({ distinct: ["organizationId"], select: { organizationId: true } });
  for (const { organizationId } of orgs) await reorder(organizationId);
}

main().finally(() => prisma.$disconnect());
