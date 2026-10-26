/**
 * Seed data for the search landing: scheduled occasion/season collections built from products
 * Downtown Mart actually stocks, a week of committed searches so "Trending near you" has data, and a
 * repeat-purchase history for the OTP review login so "Running low / Buy again" can be tested.
 * Run: cd apps/api && npx tsx prisma/seed-search-landing.ts
 */

import { PrismaClient, type CollectionKind } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const SOURCE_SLUG = "downtown-mart";
const PER_SUBCATEGORY = 3;
const MAX_ITEMS = 16;

interface ScheduledCollection {
  slug: string;
  title: string;
  subtitle: string;
  kind: CollectionKind;
  startsAt: string;
  endsAt: string;
  subcategories: string[];
}

// Dates are IST calendar days; stored as the UTC instant of IST midnight
const COLLECTIONS: ScheduledCollection[] = [
  {
    slug: "diwali-specials-2026", title: "Diwali Specials", subtitle: "Sweets, dry fruits, diyas & pooja needs",
    kind: "OCCASION", startsAt: "2026-10-12", endsAt: "2026-11-10",
    subcategories: ["Dry Sweet (Ladoo, Barfi, Peda)", "Packaged Mithai", "Gift Packs & Hampers", "Cashews (Kaju)", "Almonds (Badam)", "Mixed Dry Fruits", "Diya & Wicks", "Diyas & Decorative Candles", "Cow Ghee", "Rangoli Colours"],
  },
  {
    slug: "christmas-new-year-2026", title: "Christmas & New Year Treats", subtitle: "Cakes, chocolates & party snacks",
    kind: "OCCASION", startsAt: "2026-12-18", endsAt: "2027-01-01",
    subcategories: ["Sliced Cake", "Pastries", "Muffins & Cupcakes", "Exotic Chocolates", "Dark Chocolate", "Imported Chips & Crisps", "Soda & Tonic Water"],
  },
  {
    slug: "pongal-essentials-2027", title: "Pongal Essentials", subtitle: "Raw rice, jaggery, moong dal & ghee",
    kind: "OCCASION", startsAt: "2027-01-10", endsAt: "2027-01-17",
    subcategories: ["Non-Basmati Rice", "Jaggery (Gur)", "Jaggery Powder", "Moong Dal", "Cow Ghee", "Cashews (Kaju)", "Elaichi (Cardamom)", "Coconut (Nariyal)"],
  },
  {
    slug: "winter-warmers-2026", title: "Winter Warmers", subtitle: "Soups, chai, honey & dry fruits",
    kind: "SEASON", startsAt: "2026-11-01", endsAt: "2027-02-28",
    subcategories: ["Instant Soup", "Masala Tea", "Leaf & Dust Tea (CTC)", "Honey", "Dates (Khajoor)", "Walnuts (Akhrot)", "Malted Beverages (Bournvita, Horlicks)", "Immunity & Supplements"],
  },
  {
    slug: "monsoon-comforts-2026", title: "Monsoon Comforts", subtitle: "Chai-time snacks & hot pakora needs",
    kind: "SEASON", startsAt: "2026-07-01", endsAt: "2026-10-20",
    subcategories: ["Besan (Gram Flour)", "Bhujia & Sev", "Mixture & Chivda", "Masala Tea", "Instant Noodles", "Instant Soup", "Mosquito Coil & Mat", "Mosquito Liquid Vaporiser"],
  },
  {
    slug: "summer-coolers-2027", title: "Summer Coolers", subtitle: "Ice creams, juices & sharbat",
    kind: "SEASON", startsAt: "2027-03-01", endsAt: "2027-06-30",
    subcategories: ["Ice Cream Tubs", "Kulfi", "Mango Drinks (Frooti, Maaza)", "Rooh Afza & Sharbat", "Aam Panna", "Buttermilk (Chaas)", "Lassi", "Coconut Water"],
  },
];

// Weighted by how often a real store sees them; result counts > 0 so they qualify as trending
const SEARCHES: [string, number][] = [
  ["milk", 34], ["ghee", 22], ["diya", 18], ["kaju", 16], ["atta", 15], ["chips", 14], ["detergent", 12],
  ["badam", 11], ["sweets", 11], ["curd", 10], ["eggs", 9], ["chocolate", 9], ["rice", 8], ["oil", 8],
  ["agarbatti", 6], ["noodles", 6], ["paneer", 5], ["bread", 5],
];

// [subcategory, days between purchases, purchases, days since the last one] → overdue, due soon, not yet
const PURCHASE_HISTORY: [string, number, number, number][] = [
  ["Full Cream Milk", 3, 6, 4],
  ["Fresh Curd (Dahi)", 4, 4, 5],
  ["Wheat Atta", 15, 3, 12],
  ["Detergent Powder", 30, 2, 25],
  ["Cow Ghee", 30, 2, 8],
  ["Potato Chips", 0, 1, 6],
];
const SEED_ADDRESS = "12 Bus Stand Road, Dharmapuri 636701";
const DAY_MS = 24 * 60 * 60_000;

const istMidnight = (day: string) => new Date(`${day}T00:00:00+05:30`);
const istEndOfDay = (day: string) => new Date(`${day}T23:59:59.999+05:30`);

async function pickProducts(storeId: string, subcategoryNames: string[]) {
  const subs = await prisma.subcategory.findMany({
    where: { name: { in: subcategoryNames } },
    select: {
      name: true,
      products: {
        where: { isActive: true, storeProducts: { some: { storeId, isActive: true, stock: { gt: 0 } } } },
        take: PER_SUBCATEGORY,
        select: { id: true },
      },
    },
  });
  const ordered = subcategoryNames.map((n) => subs.find((s) => s.name === n)?.products.map((p) => p.id) ?? []);
  const ids: string[] = [];
  for (let i = 0; i < PER_SUBCATEGORY; i++) for (const col of ordered) if (col[i]) ids.push(col[i]);
  return ids.slice(0, MAX_ITEMS);
}

async function seedCollections(storeId: string, organizationId: string) {
  for (const [index, c] of COLLECTIONS.entries()) {
    const productIds = await pickProducts(storeId, c.subcategories);
    const data = {
      title: c.title, subtitle: c.subtitle, kind: c.kind, organizationId, isActive: true, sortOrder: 100 + index,
      startsAt: istMidnight(c.startsAt), endsAt: istEndOfDay(c.endsAt),
    };
    const collection = await prisma.collection.upsert({ where: { slug: c.slug }, update: data, create: { ...data, slug: c.slug } });
    await prisma.collectionItem.deleteMany({ where: { collectionId: collection.id } });
    await prisma.collectionItem.createMany({
      data: productIds.map((productId, sortOrder) => ({ collectionId: collection.id, productId, sortOrder })),
    });
    console.log(`  ${c.kind.padEnd(8)} ${c.title}: ${productIds.length} products (${c.startsAt} → ${c.endsAt})`);
  }
}

async function seedSearchLogs(organizationId: string) {
  const stores = await prisma.store.findMany({ where: { organizationId, status: "ACTIVE" }, select: { id: true } });
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true }, take: 20 });
  await prisma.searchLog.deleteMany({ where: { storeId: { in: stores.map((s) => s.id) } } });
  const rows = stores.flatMap((store) => SEARCHES.flatMap(([query, weight]) =>
    Array.from({ length: Math.max(1, Math.round(weight * (0.6 + Math.random() * 0.6))) }, () => ({
      storeId: store.id,
      // Most searches are anonymous; some tie to real customers so the distinct-user count is exercised
      userId: customers.length && Math.random() < 0.3 ? customers[Math.floor(Math.random() * customers.length)].id : null,
      query,
      resultCount: 5 + Math.floor(Math.random() * 40),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60_000),
    })),
  ));
  await prisma.searchLog.createMany({ data: rows });
  console.log(`  ${rows.length} search logs across ${stores.length} stores`);
}

async function reviewCustomer() {
  const phone = process.env.OTP_REVIEW_PHONE;
  if (!phone) throw new Error("OTP_REVIEW_PHONE missing from apps/api/.env");
  const existing = await prisma.user.findFirst({ where: { phone } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email: `${phone}@phone.martly.app`, name: "", phone, role: "CUSTOMER", passwordHash: await bcrypt.hash(crypto.randomUUID(), 10) },
  });
}

async function seedPurchaseHistory(storeId: string) {
  const user = await reviewCustomer();
  const old = await prisma.order.findMany({ where: { userId: user.id, storeId, deliveryAddress: SEED_ADDRESS }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });

  const byDay = new Map<number, { sp: any; quantity: number }[]>();
  for (const [subcategory, interval, count, lastDaysAgo] of PURCHASE_HISTORY) {
    const sp = await prisma.storeProduct.findFirst({
      where: { storeId, isActive: true, stock: { gt: 0 }, product: { isActive: true, subcategory: { name: subcategory } } },
      select: { id: true, price: true, productId: true, variantId: true },
    });
    if (!sp) continue;
    for (let i = 0; i < count; i++) {
      const day = lastDaysAgo + i * interval;
      byDay.set(day, [...(byDay.get(day) ?? []), { sp, quantity: subcategory.includes("Milk") ? 2 : 1 }]);
    }
  }
  for (const [daysAgo, lines] of byDay) {
    const createdAt = new Date(Date.now() - daysAgo * DAY_MS);
    const items = lines.map(({ sp, quantity }) => ({
      productId: sp.productId, variantId: sp.variantId, storeProductId: sp.id,
      quantity, unitPrice: Number(sp.price), totalPrice: Number(sp.price) * quantity,
    }));
    await prisma.order.create({
      data: {
        userId: user.id, storeId, status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "COD",
        totalAmount: items.reduce((sum, i) => sum + i.totalPrice, 0), deliveryAddress: SEED_ADDRESS,
        createdAt, updatedAt: createdAt, items: { create: items },
      },
    });
  }
  console.log(`  ${byDay.size} delivered orders for review login ${user.phone}`);
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: SOURCE_SLUG, town: { slug: "dharmapuri" } }, select: { id: true, organizationId: true } });
  if (!store) throw new Error(`Store ${SOURCE_SLUG} not found — run seed-stores-dharmapuri.ts first`);
  console.log("Scheduled collections:");
  await seedCollections(store.id, store.organizationId);
  console.log("Search logs:");
  await seedSearchLogs(store.organizationId);
  console.log("Purchase history:");
  await seedPurchaseHistory(store.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
