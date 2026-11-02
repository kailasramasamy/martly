/**
 * Demo sales for Walk the store's shelf signals (docs/store-walk-realism.md), so a local walk shows them: in each named
 * aisle at the store, the first cut-out pack the walk shows gets 6 shoppers this week (bestseller, trending, "6 this week") and the
 * second 5 (trending, "5 this week"). The orders are copies of an existing order, delivered, tagged by their
 * idempotency key; --remove deletes them. Local testing only: never run against prod.
 * Run: npx tsx prisma/seed-shelf-signals.ts [--store <id>] [--remove]
 */
import { PrismaClient } from "../generated/prisma/client.js";
import { walkAisle } from "../src/services/store-walk.js";

const prisma = new PrismaClient();
const TAG = "shelf-signals-demo";
// Sree Ranga, not Template Store: shoppers never see template stores
const SREE_RANGA = "8f56d5c1-7a4d-4e87-8fe1-2d0b8600c839";
const AISLES = ["Atta & Flours", "Biscuits & Cookies"];
const SHOPPERS = [6, 5];

function storeArg() {
  const i = process.argv.indexOf("--store");
  return i > 0 ? process.argv[i + 1] : SREE_RANGA;
}

async function remove() {
  const orders = await prisma.order.findMany({ where: { idempotencyKey: { startsWith: TAG } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Removed ${ids.length} demo orders`);
}

// The first packs with a cut-out among those the walk shows in the aisle
async function packsIn(storeId: string, aisle: string) {
  const category = await prisma.category.findFirstOrThrow({ where: { name: aisle }, select: { id: true } });
  const shown = await walkAisle(prisma, storeId, null, { categoryId: category.id });
  return (shown?.popular ?? []).filter((sp) => sp.product.cutoutUrl).slice(0, SHOPPERS.length);
}

// One delivered order a shopper placed in the last few days, for one pack
async function sell(storeId: string, pack: { id: string; productId: string; variantId: string }, shoppers: number) {
  await prisma.$executeRaw`
    WITH src AS (SELECT * FROM orders LIMIT 1),
    buyers AS (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS n FROM users ORDER BY id LIMIT ${shoppers}),
    made AS (
      INSERT INTO orders SELECT (jsonb_populate_record(NULL::orders, to_jsonb(src) || jsonb_build_object(
        'id', gen_random_uuid()::text, 'user_id', b.id, 'store_id', ${storeId}::text, 'status', 'DELIVERED',
        'idempotency_key', ${TAG} || '-' || gen_random_uuid()::text, 'created_at', now() - make_interval(days => (b.n % 5)::int)))).*
      FROM src, buyers b RETURNING id)
    INSERT INTO order_items SELECT (jsonb_populate_record(NULL::order_items, to_jsonb(oi) || jsonb_build_object(
      'id', gen_random_uuid()::text, 'order_id', made.id, 'product_id', ${pack.productId}::text,
      'variant_id', ${pack.variantId}::text, 'store_product_id', ${pack.id}::text, 'quantity', 1))).*
    FROM made, (SELECT * FROM order_items LIMIT 1) oi`;
}

async function main() {
  await remove();
  if (process.argv.includes("--remove")) return;
  const storeId = storeArg();
  for (const aisle of AISLES) {
    const packs = await packsIn(storeId, aisle);
    for (const [i, pack] of packs.entries()) {
      await sell(storeId, pack, SHOPPERS[i]);
      console.log(`${aisle}: ${pack.product.name}, ${SHOPPERS[i]} shoppers this week`);
    }
  }
}

main().finally(() => prisma.$disconnect());
