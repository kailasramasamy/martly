/**
 * Seeds the paid-marketing price list and slot limits. Only creates what's missing, so prices edited in the
 * admin pricing page are never overwritten.
 *
 *   cd apps/api && npx tsx prisma/seed-ad-pricing.ts
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

const PRODUCTS = [
  { kind: "STORE_PLAN", code: "FREE", name: "Free", description: "1 banner, no promotions", price: 0, durationDays: 30, bannerSlots: 1, promotionCredits: 0, pushIncluded: false, aiImagesPerMonth: 2, sortOrder: 0 },
  { kind: "STORE_PLAN", code: "GROWTH", name: "Growth", description: "4 banners and 2 AI promotions a month", price: 999, durationDays: 30, bannerSlots: 4, promotionCredits: 2, pushIncluded: false, aiImagesPerMonth: 10, sortOrder: 1 },
  { kind: "STORE_PLAN", code: "PRO", name: "Pro", description: "Unlimited banners, 6 AI promotions a month, push notifications", price: 2499, durationDays: 30, bannerSlots: null, promotionCredits: 6, pushIncluded: true, aiImagesPerMonth: 30, sortOrder: 2 },
  { kind: "PROMOTION_TOPUP", code: "PROMO_TOPUP", name: "Extra promotion", description: "One more AI promotion, valid until used", price: 399, durationDays: 30, bannerSlots: null, promotionCredits: 1, pushIncluded: false, sortOrder: 0 },
  { kind: "BRAND_BANNER", code: "BRAND_BANNER_WEEK", name: "Brand banner", description: "Home carousel in every store that stocks the brand, per week", price: 7500, durationDays: 7, placement: "HERO_CAROUSEL", sortOrder: 0 },
  { kind: "BRAND_TAKEOVER", code: "CATEGORY_TAKEOVER_WEEK", name: "Category takeover", description: "Top of one category in every store that stocks the brand, per week", price: 4500, durationDays: 7, placement: "CATEGORY_TOP", sortOrder: 1 },
  { kind: "BRAND_PROMOTION", code: "BRAND_PROMOTION_WEEK", name: "Brand promotion", description: "Discount on the brand's products with a home banner, per week", price: 15000, durationDays: 7, placement: "HERO_CAROUSEL", sortOrder: 2 },
  { kind: "BRAND_CPM", code: "BRAND_CPM_1000", name: "Brand views", description: "Home carousel, billed per 1,000 views", price: 200, durationDays: 30, placement: "HERO_CAROUSEL", viewsPerUnit: 1000, isActive: false, sortOrder: 3 },
] as const;

const SLOT_LIMITS = {
  HERO_CAROUSEL: { STORE: 4, BRAND: 2, PLATFORM: 1 },
  CATEGORY_TOP: { BRAND: 1 },
  MID_PAGE: { BRAND: 1 },
};

async function main() {
  for (const p of PRODUCTS) {
    await prisma.adProduct.upsert({ where: { code: p.code }, create: { bannerSlots: null, promotionCredits: 0, pushIncluded: false, ...p }, update: {} });
  }
  const config = await prisma.marketingConfig.upsert({ where: { id: "default" }, create: { id: "default", slotLimits: SLOT_LIMITS }, update: {} });
  // Fill slot limits only while they're still the empty default
  if (!Object.keys(config.slotLimits as object).length) {
    await prisma.marketingConfig.update({ where: { id: "default" }, data: { slotLimits: SLOT_LIMITS } });
  }
  console.log(`Price list: ${await prisma.adProduct.count()} packages`);
}

main().finally(() => prisma.$disconnect());
