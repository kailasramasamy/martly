/**
 * Puts buy X get Y offers on everyday packs (biscuits, snacks, noodles, soaps, shampoo) at every active store, so the
 * Buy 1 Get 1 row and its full list have something to show. Mostly 1+1, a few 2+1; no end date.
 *
 *   cd apps/api && npx tsx prisma/seed-buy-get-offers.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

const SUBCATEGORIES = ["Cream Biscuits", "Cashew & Butter Cookies", "Potato Chips", "Instant Noodles", "Bathing Soap (Bar)", "Shampoo", "Milk Chocolate", "Chocolate Bars & Countlines"];
const PER_STORE = 16;
// Every fourth offer is 2+1
const offerFor = (i: number) => (i % 4 === 3 ? { offerBuyQty: 2, offerGetQty: 1 } : { offerBuyQty: 1, offerGetQty: 1 });

async function main() {
  const stores = await prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  for (const store of stores) {
    const listings = await prisma.storeProduct.findMany({
      where: {
        storeId: store.id, isActive: true, stock: { gt: 5 },
        product: { subcategory: { name: { in: SUBCATEGORIES, mode: "insensitive" } }, imageUrl: { not: null } },
      },
      distinct: ["productId"],
      orderBy: { productId: "asc" },
      take: PER_STORE,
      select: { id: true },
    });
    await prisma.$transaction(listings.map((l, i) => prisma.storeProduct.update({ where: { id: l.id }, data: offerFor(i) })));
    console.log(`${store.name}: ${listings.length} offers`);
  }
}

main().finally(() => prisma.$disconnect());
