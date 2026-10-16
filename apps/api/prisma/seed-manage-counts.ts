/**
 * Seeds a submitted stock count at Harur Fresh Mart for testing review, recount and correction:
 * most lines match system stock, three are off. Re-running replaces the seeded count.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-counts.ts
 *
 * Needs seed-manage-users.ts first (counter@harur.dev). Review it as manager@harur.dev.
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const NOTE = "Seeded count for recount testing";
// Offsets for the first lines: two short, one over; the rest match the shelf
const OFFSETS = [-6, 4, -12];

async function main() {
  const store = await prisma.store.findFirstOrThrow({ where: { name: "Harur Fresh Mart" } });
  const counter = await prisma.user.findUniqueOrThrow({ where: { email: "counter@harur.dev" } });
  // An aisle with a handful of stocked products
  const sub = await prisma.subcategory.findFirstOrThrow({
    where: { products: { some: { storeProducts: { some: { storeId: store.id, stock: { gt: 15 } } } } }, name: { contains: "Ghee" } },
  });
  const products = await prisma.storeProduct.findMany({
    where: { storeId: store.id, product: { subcategoryId: sub.id } },
    select: { id: true, stock: true },
    orderBy: { stock: "desc" },
    take: 12,
  });

  await prisma.stockCount.deleteMany({ where: { storeId: store.id, note: NOTE } });
  const count = await prisma.stockCount.create({
    data: {
      organizationId: store.organizationId, storeId: store.id, subcategoryId: sub.id, note: NOTE,
      createdById: counter.id, status: "SUBMITTED", submittedAt: new Date(),
    },
  });
  for (const [i, sp] of products.entries()) {
    const counted = Math.max(0, sp.stock + (OFFSETS[i] ?? 0));
    await prisma.stockCountLine.create({
      data: {
        stockCountId: count.id, storeProductId: sp.id, countedQty: counted, systemQty: sp.stock,
        revisions: { create: { kind: "COUNT", qty: counted, userId: counter.id } },
      },
    });
  }
  console.log(`Submitted count ${count.id}: ${sub.name}, ${products.length} lines, ${Math.min(OFFSETS.length, products.length)} off`);
}

main().finally(() => prisma.$disconnect());
