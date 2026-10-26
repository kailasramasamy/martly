/**
 * Gives a shopper (the phone passed, else the review login OTP_REVIEW_PHONE) a monthly provision list at Template Store: one best-stocked product from
 * each staple aisle, with the reminder day set to today so it is due (it shows on Home and the scheduler would remind).
 * Two lines carry history so the list has something to flag: one was cheaper last month, one hasn't been ordered in
 * 70 days.
 *
 *   cd apps/api && npx tsx prisma/seed-monthly-list.ts [phone]
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";
import { istNow } from "../src/services/ist-day.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();
const STORE_NAME = "Template Store";
// One month's provisions for a household, aisle by aisle, with how many of each
const STAPLES: [string, number][] = [
  ["Parboiled Rice", 1], ["Wheat Atta", 1], ["Toor Dal (Arhar)", 2], ["Urad Dal", 1], ["Groundnut Oil", 2],
  ["Sesame Oil (Til)", 1], ["White Sugar", 1], ["Leaf & Dust Tea (CTC)", 1], ["Detergent Powder", 1],
];
// Every month has days 1 to 28
const LAST_REMINDER_DAY = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

// The listing with the most stock in the aisle, so the list stays orderable
async function stapleAt(storeId: string, subcategory: string) {
  return prisma.storeProduct.findFirst({
    where: { storeId, isActive: true, stock: { gt: 10 }, product: { isActive: true, imageUrl: { not: null }, subcategory: { name: subcategory } } },
    orderBy: { stock: "desc" },
    select: { productId: true, variantId: true, price: true },
  });
}

async function main() {
  const phone = process.argv[2] ?? process.env.OTP_REVIEW_PHONE;
  if (!phone) throw new Error("Pass a phone number, or set OTP_REVIEW_PHONE in apps/api/.env");
  const [user, store] = await Promise.all([
    prisma.user.findFirst({ where: { phone }, select: { id: true } }),
    prisma.store.findFirst({ where: { name: STORE_NAME, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!user || !store) throw new Error(`Review user (${phone}) or ${STORE_NAME} not found`);
  const found = await Promise.all(STAPLES.map(async ([name, quantity]) => ({ sp: await stapleAt(store.id, name), quantity })));
  const lines = found.flatMap(({ sp, quantity }) => (sp ? [{ ...sp, quantity }] : []));
  const reminderDay = Math.min(Number(istNow().key.slice(8, 10)), LAST_REMINDER_DAY);
  const lastMonth = new Date(Date.now() - 30 * DAY_MS);

  const list = await prisma.monthlyList.upsert({
    where: { userId_storeId: { userId: user.id, storeId: store.id } },
    create: { userId: user.id, storeId: store.id, reminderDay },
    update: { reminderDay, pushOn: true, whatsappOn: true, isActive: true, lastRemindedMonth: null, lastOrderedMonth: null },
  });
  await prisma.monthlyListItem.deleteMany({ where: { listId: list.id } });
  await prisma.monthlyListItem.createMany({
    data: lines.map((l, i) => ({
      listId: list.id, productId: l.productId, variantId: l.variantId, quantity: l.quantity,
      // The first line cost ₹12 less last month; the last hasn't been ordered in 70 days
      lastPrice: i === 0 ? Number(l.price) - 12 : Number(l.price),
      lastOrderedAt: i === lines.length - 1 ? new Date(Date.now() - 70 * DAY_MS) : lastMonth,
    })),
  });
  console.log(`Monthly list ${list.id}: ${lines.length} of ${STAPLES.length} staples found, reminder day ${reminderDay}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
