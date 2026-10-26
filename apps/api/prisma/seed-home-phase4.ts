/**
 * Phase 4 showcase for Martly Template / Template Store: three advertised coupons, two live brand posters (painted
 * portrait art) and a live sponsored product. Idempotent: live campaigns and existing coupons are kept. Pushes are
 * off (no FCM client), so seeding never notifies anyone.
 *
 *   cd apps/api && npx tsx prisma/seed-home-phase4.ts
 */
import "../src/load-env.js";
import { PrismaClient } from "../generated/prisma/index.js";
import { createCampaign } from "../src/services/brand-campaigns/booking.js";
import { generateCampaignArt } from "../src/services/brand-campaigns/art.js";
import { startCampaign } from "../src/services/brand-campaigns/go-live.js";
import { ORG_NAME, STORE_ID } from "./seed-home-collections.js";

const prisma = new PrismaClient();
const log = { warn: console.warn, error: console.error, info: console.log } as never;

const COUPONS = [
  { code: "WELCOME50", title: "Flat ₹50 off", description: "On your order above ₹299", discountType: "FLAT", discountValue: 50, minOrderAmount: 299 },
  { code: "SAVE20", title: "20% off, up to ₹100", description: "On orders above ₹499", discountType: "PERCENTAGE", discountValue: 20, maxDiscount: 100, minOrderAmount: 499 },
  { code: "SNACK30", title: "₹30 off snacks run", description: "On orders above ₹199", discountType: "FLAT", discountValue: 30, minOrderAmount: 199 },
] as const;

const POSTERS = [
  { brand: "Cadbury (Mondelez)", title: "Make every moment sweeter", subtitle: "Dairy Milk, Silk and more", brief: "A joyful flat-lay of Cadbury-style purple chocolate bars, broken chunks and a gift box, warm festive light" },
  { brand: "Amul", title: "The taste of India", subtitle: "Butter, cheese and milk", brief: "A golden butter block on toast, a glass of milk and cheese slices on a sunny breakfast table" },
];

async function coupons(organizationId: string) {
  for (const c of COUPONS) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: { showOnHome: true, title: c.title }, create: { ...c, organizationId, showOnHome: true, perUserLimit: 1 } });
  }
}

async function launch(campaignId: string) {
  const campaign = await prisma.brandCampaign.update({ where: { id: campaignId }, data: { status: "SCHEDULED", startsAt: new Date() } });
  await startCampaign({ prisma, fcm: null, log }, campaign);
}

// A live campaign with this title already running is left alone
async function running(brandId: string, title: string) {
  return prisma.brandCampaign.findFirst({ where: { brandId, title, status: "LIVE" } });
}

async function posters(createdById: string) {
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { code: "BRAND_POSTER_WEEK" } });
  for (const p of POSTERS) {
    const brand = await prisma.brand.findFirstOrThrow({ where: { name: p.brand } });
    if (await running(brand.id, p.title)) continue;
    const booked = await createCampaign(prisma, {
      brandId: brand.id, productId: product.id, title: p.title, subtitle: p.subtitle, brief: p.brief,
      actionType: "BRAND", targetStoreIds: [], quantity: 4, startsAt: new Date(),
    }, createdById);
    await generateCampaignArt(prisma, booked, log);
    await launch(booked.id);
    console.log(`Poster live: ${p.brand}`);
  }
}

async function sponsored(createdById: string) {
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { code: "SPONSORED_PRODUCT_WEEK" } });
  const brand = await prisma.brand.findFirstOrThrow({ where: { name: "Lay's (PepsiCo)" } });
  const title = "Lay's in your snack aisle";
  if (await running(brand.id, title)) return;
  const item = await prisma.product.findFirstOrThrow({
    where: { brandId: brand.id, isActive: true, imageUrl: { not: null }, storeProducts: { some: { storeId: STORE_ID, isActive: true, stock: { gt: 0 } } } },
    orderBy: { name: "asc" }, select: { id: true, name: true },
  });
  const booked = await createCampaign(prisma, {
    brandId: brand.id, productId: product.id, title, actionType: "PRODUCT", actionTarget: item.id, targetStoreIds: [], quantity: 4, startsAt: new Date(),
  }, createdById);
  await launch(booked.id);
  console.log(`Sponsored product live: ${item.name}`);
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  const owner = await prisma.user.findFirstOrThrow({ where: { email: "demo@martly.in" }, select: { id: true } });
  await coupons(org.id);
  await posters(owner.id);
  await sponsored(owner.id);
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
