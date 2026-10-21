/**
 * Features Sakthi Masala for the first organisation, so search ("chilli powder"), the spices category and list orders
 * show a "Featured" brand. Own-brand boosting is on by default; any brand with organizationId set is "Our brand".
 *
 *   cd apps/api && npx tsx prisma/seed-brand-boost.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sakthi-masala" }, select: { id: true, name: true } });
  await prisma.orgBrandFeature.upsert({
    where: { organizationId_brandId: { organizationId: org.id, brandId: brand.id } },
    create: { organizationId: org.id, brandId: brand.id },
    update: {},
  });
  console.log(`${org.name} now features ${brand.name}`);
}

main().finally(() => prisma.$disconnect());
