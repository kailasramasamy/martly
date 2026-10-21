/**
 * A live sponsored product for Everest Kashmirilal Chilli Powder (four weeks), so "chilli powder" shows an Ad in search,
 * suggestions, the spices category and list orders. Skips if one already runs for that product.
 *
 *   cd apps/api && npx tsx prisma/seed-sponsored-search.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const PRODUCT_NAME = "Everest Kashmirilal Chilli Powder";
const WEEKS = 4;

async function main() {
  const product = await prisma.product.findFirstOrThrow({
    where: { name: PRODUCT_NAME },
    select: { id: true, imageUrl: true, brandId: true, subcategory: { select: { categoryId: true } } },
  });
  const existing = await prisma.banner.findFirst({ where: { placement: "SPONSORED_PRODUCT", actionTarget: product.id, isActive: true } });
  if (existing) return console.log(`Already sponsored: ${existing.title}`);
  const startsAt = new Date();
  const banner = await prisma.banner.create({
    data: {
      title: "Everest in your spice aisle", imageUrl: product.imageUrl ?? "", placement: "SPONSORED_PRODUCT",
      actionType: "PRODUCT", actionTarget: product.id, categoryId: product.subcategory!.categoryId,
      sponsorType: "BRAND", brandId: product.brandId, startsAt, endsAt: new Date(startsAt.getTime() + WEEKS * 7 * 86_400_000),
    },
  });
  console.log(`Sponsored ${PRODUCT_NAME} until ${banner.endsAt?.toDateString()}`);
}

main().finally(() => prisma.$disconnect());
