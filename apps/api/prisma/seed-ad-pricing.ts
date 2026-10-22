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
  { kind: "STORE_PLAN", code: "FREE", name: "Free", description: "No promotions, 5 AI images a month", price: 0, durationDays: 30, promotionCredits: 0, pushIncluded: false, aiImagesPerMonth: 5, sortOrder: 0 },
  { kind: "STORE_PLAN", code: "GROWTH", name: "Growth", description: "2 promotions and 30 AI images a month", price: 999, yearlyPrice: 9990, durationDays: 30, promotionCredits: 2, pushIncluded: false, aiImagesPerMonth: 30, sortOrder: 1 },
  { kind: "STORE_PLAN", code: "PRO", name: "Pro", description: "6 promotions and 100 AI images a month, push notifications", price: 2499, yearlyPrice: 24990, durationDays: 30, promotionCredits: 6, pushIncluded: true, aiImagesPerMonth: 100, sortOrder: 2 },
  { kind: "PROMOTION_TOPUP", code: "PROMO_TOPUP", name: "Extra promotion", description: "One more promotion, valid until used", price: 599, durationDays: 30, promotionCredits: 1, pushIncluded: false, sortOrder: 0 },
  { kind: "AI_IMAGE_PACK", code: "AI_IMAGES_25", name: "25 AI images", description: "25 more AI images, valid until used", price: 299, durationDays: 30, aiImageCredits: 25, sortOrder: 0 },
  { kind: "AI_IMAGE_PACK", code: "AI_IMAGES_100", name: "100 AI images", description: "100 more AI images, valid until used", price: 999, durationDays: 30, aiImageCredits: 100, sortOrder: 1 },
  { kind: "BRAND_BANNER", code: "BRAND_BANNER_WEEK", name: "Brand banner", description: "Home carousel in every store that stocks the brand, per week", price: 7500, durationDays: 7, placement: "HERO_CAROUSEL", sortOrder: 0 },
  { kind: "BRAND_TAKEOVER", code: "CATEGORY_TAKEOVER_WEEK", name: "Category takeover", description: "Top of one category in every store that stocks the brand, per week", price: 4500, durationDays: 7, placement: "CATEGORY_TOP", sortOrder: 1 },
  { kind: "BRAND_PROMOTION", code: "BRAND_PROMOTION_WEEK", name: "Brand promotion", description: "Discount on the brand's products with a home banner and a shoppable offer card on Home, per week", price: 15000, durationDays: 7, placement: "HERO_CAROUSEL", sortOrder: 2 },
  { kind: "BRAND_CPM", code: "BRAND_CPM_1000", name: "Brand views", description: "Home carousel, billed per 1,000 views", price: 200, durationDays: 30, placement: "HERO_CAROUSEL", viewsPerUnit: 1000, isActive: false, sortOrder: 3 },
  { kind: "BRAND_FEATURE", code: "FEATURED_BRAND_WEEK", name: "Featured brand", description: "The brand's products rank ahead in search, category pages and list orders, marked Featured, per week", price: 4000, durationDays: 7, sortOrder: 5 },
  { kind: "BRAND_TAB_SLOT", code: "BRAND_TAB_WEEK", name: "Brand tab slot", description: "The brand's logo in the app's bottom bar, opening its brand page, per week", price: 10000, durationDays: 7, placement: "BRAND_TAB", sortOrder: 6 },
] as const;

// Brand campaigns per placement at once; store promotions are never capped
const SLOT_LIMITS = {
  HERO_CAROUSEL: { BRAND: 2 },
  CATEGORY_TOP: { BRAND: 1 },
  BRAND_TAB: { BRAND: 1 },
};

async function main() {
  for (const p of PRODUCTS) {
    await prisma.adProduct.upsert({ where: { code: p.code }, create: { promotionCredits: 0, pushIncluded: false, ...p }, update: {} });
  }
  const config = await prisma.marketingConfig.upsert({ where: { id: "default" }, create: { id: "default", slotLimits: SLOT_LIMITS }, update: {} });
  // Fill slot limits only while they're still the empty default
  if (!Object.keys(config.slotLimits as object).length) {
    await prisma.marketingConfig.update({ where: { id: "default" }, data: { slotLimits: SLOT_LIMITS } });
  }
  console.log(`Price list: ${await prisma.adProduct.count()} packages`);
}

main().finally(() => prisma.$disconnect());
