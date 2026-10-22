/**
 * Seeds sample marketing data for the mobile Manage persona against Demo Grocers. Idempotent.
 * Historical campaigns are inserted directly, so nothing is pushed to any device.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-marketing.ts
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

const COUPONS = [
  { code: "MGRWELCOME10", description: "10% off your first order", discountType: "PERCENTAGE", discountValue: 10, maxDiscount: 100, minOrderAmount: 199, usageLimit: 500, startsAt: daysFromNow(-10), expiresAt: daysFromNow(60) },
  { code: "MGRFLAT50", description: "Flat 50 off on 499+", discountType: "FLAT", discountValue: 50, minOrderAmount: 499, usageLimit: null, startsAt: null, expiresAt: null },
  { code: "MGROLD20", description: "Expired festive offer", discountType: "PERCENTAGE", discountValue: 20, maxDiscount: 200, minOrderAmount: null, usageLimit: 100, startsAt: daysFromNow(-90), expiresAt: daysFromNow(-30) },
  { code: "MGRSOON15", description: "Starts next week", discountType: "PERCENTAGE", discountValue: 15, maxDiscount: 150, minOrderAmount: 299, usageLimit: 200, startsAt: daysFromNow(7), expiresAt: daysFromNow(37) },
] as const;

const BANNERS = [
  { title: "Fresh produce, delivered", placement: "HERO_CAROUSEL", sortOrder: 0, imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=600&fit=crop", actionType: "SEARCH", actionTarget: "vegetables" },
  { title: "Dairy essentials", placement: "HERO_CAROUSEL", sortOrder: 1, imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=900&h=600&fit=crop", actionType: "SEARCH", actionTarget: "milk" },
] as const;

async function seedCoupons(organizationId: string) {
  for (const c of COUPONS) {
    const data = { ...c, organizationId, perUserLimit: 1, isActive: true };
    await prisma.coupon.upsert({ where: { code: c.code }, create: data, update: data });
  }
}

async function seedBanners(organizationId: string) {
  for (const b of BANNERS) {
    const existing = await prisma.banner.findFirst({ where: { organizationId, title: b.title } });
    if (!existing) await prisma.banner.create({ data: { ...b, organizationId, isActive: true } });
  }
}

async function seedPrograms(organizationId: string, customerIds: string[]) {
  await prisma.loyaltyConfig.upsert({
    where: { organizationId },
    create: { organizationId, isEnabled: true, earnRate: 1, minRedeemPoints: 10, maxRedeemPercentage: 50, reviewRewardPoints: 0 },
    update: {},
  });
  await prisma.referralConfig.upsert({
    where: { organizationId },
    create: { organizationId, isEnabled: true, referrerReward: 50, refereeReward: 25, maxReferralsPerUser: 50 },
    update: {},
  });
  for (const userId of customerIds.slice(0, 2)) {
    await prisma.loyaltyBalance.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: { userId, organizationId, points: 120, totalEarned: 150, totalRedeemed: 30 },
      update: {},
    });
  }
  if (customerIds.length >= 2) {
    await prisma.referral.upsert({
      where: { refereeId_organizationId: { refereeId: customerIds[1], organizationId } },
      create: { referrerId: customerIds[0], refereeId: customerIds[1], organizationId, status: "COMPLETED", referrerReward: 50, refereeReward: 25, completedAt: new Date() },
      update: {},
    });
  }
}

async function seedNotifications(organizationId: string, adminId: string, customerIds: string[]) {
  const name = "Weekend offers";
  if (!(await prisma.notificationTemplate.findFirst({ where: { organizationId, name } }))) {
    await prisma.notificationTemplate.create({ data: { organizationId, name, title: "Weekend offers are here", body: "Fresh deals on fruits, dairy and staples. Tap to shop.", type: "PROMOTIONAL", createdBy: adminId } });
  }
  const title = "Fresh arrivals this week";
  if (await prisma.notificationCampaign.findFirst({ where: { organizationId, title } })) return;
  const campaign = await prisma.notificationCampaign.create({
    data: { organizationId, title, body: "New seasonal fruits just landed at your store.", type: "PROMOTIONAL", audienceType: "ALL_CUSTOMERS", status: "SENT", recipientCount: customerIds.length, sentAt: daysFromNow(-2), sentBy: adminId },
  });
  await prisma.notification.createMany({
    data: customerIds.map((userId, i) => ({ userId, type: "PROMOTIONAL" as const, title, body: campaign.body, campaignId: campaign.id, isRead: i % 2 === 0 })),
  });
}

async function seedSubscription(organizationId: string, customerId: string) {
  if (await prisma.subscription.findFirst({ where: { organizationId } })) return;
  const store = await prisma.store.findFirst({ where: { organizationId, name: "Harur Fresh Mart" } });
  const items = store ? await prisma.storeProduct.findMany({ where: { storeId: store.id, isActive: true }, take: 2 }) : [];
  if (!store || items.length === 0) return;
  await prisma.subscription.create({
    data: {
      userId: customerId, storeId: store.id, organizationId, frequency: "DAILY", deliveryAddress: "12 Main Road, Harur, Dharmapuri",
      nextDeliveryDate: daysFromNow(1), items: { create: items.map((sp) => ({ storeProductId: sp.id, quantity: 1 })) },
    },
  });
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "demo-grocers" } });
  const admin = await prisma.user.findFirst({ where: { email: "owner@demogrocers.dev" } });
  if (!org || !admin) throw new Error("Run seed-manage-users.ts first (Demo Grocers org and owner needed)");
  const orders = await prisma.order.findMany({ where: { store: { organizationId: org.id } }, select: { userId: true }, distinct: ["userId"] });
  const customerIds = orders.map((o) => o.userId);

  await seedCoupons(org.id);
  await seedBanners(org.id);
  await seedPrograms(org.id, customerIds);
  await seedNotifications(org.id, admin.id, customerIds);
  if (customerIds[0]) await seedSubscription(org.id, customerIds[0]);
  console.log(`Seeded marketing data for ${org.name} (${customerIds.length} customers with orders)`);
}

main().finally(() => prisma.$disconnect());
