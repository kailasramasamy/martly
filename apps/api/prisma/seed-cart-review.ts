/**
 * Seed data for the cart review: a repeat-purchase history at Harur Fresh Mart for the OTP review login,
 * dated so some staples are due or overdue, which fills the cart's "Did you forget?" rail.
 * Run: cd apps/api && npx tsx prisma/seed-cart-review.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const STORE_SLUG = "harur-fresh-mart-bus-stand";
const SEED_ADDRESS = "Cart review seed, Bus Stand Road, Harur 636903";
const DAY_MS = 24 * 60 * 60_000;

// [subcategory, days between purchases, purchases, days since the last one]
const PURCHASE_HISTORY: [string, number, number, number][] = [
  ["Toned Milk", 3, 6, 4],
  ["Fresh Curd (Dahi)", 4, 4, 5],
  ["White Eggs", 7, 3, 6],
  ["Sandwich Bread", 5, 3, 6],
  ["Wheat Atta", 15, 3, 12],
  ["Detergent Powder", 30, 2, 25],
  ["Cow Ghee", 30, 2, 40],
];

async function main() {
  const phone = process.env.OTP_REVIEW_PHONE;
  if (!phone) throw new Error("OTP_REVIEW_PHONE missing from apps/api/.env");
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) throw new Error(`No user with phone ${phone} — sign in once with the review login first`);
  const store = await prisma.store.findUnique({ where: { slug: STORE_SLUG }, select: { id: true } });
  if (!store) throw new Error(`Store ${STORE_SLUG} not found`);

  const old = await prisma.order.findMany({ where: { userId: user.id, storeId: store.id, deliveryAddress: SEED_ADDRESS }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });

  const byDay = new Map<number, { sp: { id: string; price: unknown; productId: string; variantId: string }; quantity: number }[]>();
  for (const [subcategory, interval, count, lastDaysAgo] of PURCHASE_HISTORY) {
    const sp = await prisma.storeProduct.findFirst({
      where: { storeId: store.id, isActive: true, stock: { gt: 5 }, product: { isActive: true, imageUrl: { not: null }, subcategory: { name: subcategory } } },
      select: { id: true, price: true, productId: true, variantId: true },
    });
    if (!sp) {
      console.log(`  skipped ${subcategory}: none in stock`);
      continue;
    }
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
        userId: user.id, storeId: store.id, status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "COD",
        totalAmount: items.reduce((sum, i) => sum + i.totalPrice, 0), deliveryAddress: SEED_ADDRESS,
        createdAt, updatedAt: createdAt, items: { create: items },
      },
    });
  }
  console.log(`${byDay.size} delivered orders for review login ${phone} at ${STORE_SLUG}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
