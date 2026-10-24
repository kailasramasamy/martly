/**
 * Fills the blank Tamil headline and description of every coupon that has a headline (coupons without one get Tamil
 * made from their discount when shown). Safe to re-run: Tamil already there is kept.
 *
 *   cd apps/api && npx tsx prisma/translate-coupons.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";
import { translateCoupon } from "../src/services/translate/coupon.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const log = { error: (err: unknown, msg: string) => console.error(msg, err) };

async function main() {
  const coupons = await prisma.coupon.findMany({ where: { title: { not: null } }, select: { id: true, code: true } });
  for (const c of coupons) {
    await translateCoupon(prisma, c.id, log);
    console.log(`  ${c.code}`);
  }
  const done = await prisma.coupon.findMany({ where: { title: { not: null } }, select: { code: true, title: true, translations: true } });
  for (const c of done) console.log(c.code, "|", c.title, "→", (c.translations as { ta?: { title?: string } } | null)?.ta?.title ?? "(none)");
}

main().finally(() => prisma.$disconnect());
