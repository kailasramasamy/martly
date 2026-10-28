/**
 * Mark listings the store has already sold or received as carried, so Stock check starts from what's known.
 *
 * Usage: cd apps/api && npx tsx scripts/backfill-carried.ts [--dry-run]
 * Only unconfirmed listings (carried IS NULL) change; a store's own "not sold here" is never overridden.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const EVIDENCE = `
  SELECT oi.store_product_id AS id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status <> 'CANCELLED'
  UNION
  SELECT sm.store_product_id FROM stock_movements sm
  -- Onboarding logs its assumed opening stock as a receipt; only real deliveries count
  WHERE sm.type = 'RECEIVE' AND sm.note IS DISTINCT FROM 'Opening stock'`;

async function main() {
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count FROM store_products WHERE carried IS NULL AND id IN (${EVIDENCE})`,
  );
  console.log(`${count} unconfirmed listings have sales or receipts`);
  if (dryRun || count === 0) return;
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE store_products SET carried = true, is_active = true WHERE carried IS NULL AND id IN (${EVIDENCE})`,
  );
  console.log(`Marked ${updated} carried`);
}

main().finally(() => prisma.$disconnect());
