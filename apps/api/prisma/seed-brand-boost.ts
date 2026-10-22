/**
 * Books Sakthi Masala as a live featured brand in its main category (spices) across all stores for a week, so search
 * ("chilli powder"), the spices category and list orders show a "Featured" brand. Own-brand boosting is on by default; any brand with
 * organizationId set is "Our brand".
 *
 *   cd apps/api && npx tsx prisma/seed-ad-pricing.ts && npx tsx prisma/seed-brand-boost.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  const [brand, product, admin] = await Promise.all([
    prisma.brand.findFirstOrThrow({ where: { slug: "sakthi-masala" }, select: { id: true, name: true } }),
    prisma.adProduct.findUniqueOrThrow({ where: { code: "FEATURED_BRAND_WEEK" }, select: { id: true } }),
    prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", deletedAt: null }, select: { id: true } }),
  ]);
  // The category holding most of the brand's products
  const [main] = await prisma.$queryRaw<{ category_id: string }[]>`
    SELECT s.category_id FROM products p JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.brand_id = ${brand.id} AND p.is_active GROUP BY s.category_id ORDER BY COUNT(*) DESC LIMIT 1`;
  const live = await prisma.brandCampaign.findFirst({ where: { brandId: brand.id, productId: product.id, status: "LIVE" } });
  if (live) {
    await prisma.brandCampaign.update({ where: { id: live.id }, data: { categoryId: main.category_id } });
    return console.log(`${brand.name} is already featured until ${live.endsAt.toISOString()}`);
  }
  const startsAt = new Date();
  await prisma.brandCampaign.create({
    data: {
      brandId: brand.id, productId: product.id, categoryId: main.category_id, title: `${brand.name} featured`, status: "LIVE", createdById: admin.id,
      startsAt, endsAt: new Date(startsAt.getTime() + WEEK_MS),
    },
  });
  console.log(`${brand.name} is featured in its main category in every store that carries it for a week`);
}

main().finally(() => prisma.$disconnect());
