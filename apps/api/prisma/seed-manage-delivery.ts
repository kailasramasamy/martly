/**
 * Seeds the Manage delivery board for Template Store: 2 riders and 5 READY delivery orders dated today.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-delivery.ts
 *
 * Re-runs replace only their own records: riders by email suffix, orders by deliveryNotes tag.
 */
import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const TAG = "manage-seed";
const RIDERS = [
  { email: "arun.rider@manage-seed.martly.dev", name: "Arun Kumar", phone: "9876500101" },
  { email: "bala.rider@manage-seed.martly.dev", name: "Bala Murugan", phone: "9876500102" },
];
const DROPS = [
  { address: "12 Gandhi Road, Harur", pincode: "636903" },
  { address: "45 Bus Stand Street, Harur", pincode: "636903" },
  { address: "7 Temple Lane, Harur", pincode: "636903" },
  { address: "88 Kottai Road, Kottapatti", pincode: "636905" },
  { address: "21 Market Street, Kottapatti", pincode: "636905" },
];

async function clearPrevious(storeId: string) {
  const old = await prisma.order.findMany({ where: { storeId, deliveryNotes: TAG }, select: { id: true, deliveryTripId: true } });
  const ids = old.map((o) => o.id);
  const tripIds = [...new Set(old.flatMap((o) => (o.deliveryTripId ? [o.deliveryTripId] : [])))];
  await prisma.orderStatusLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.deliveryTrip.deleteMany({ where: { id: { in: tripIds }, orders: { none: {} } } });
}

async function seedRiders(storeId: string) {
  const passwordHash = await bcrypt.hash("rider123", 10);
  for (const r of RIDERS) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: { name: r.name, phone: r.phone, role: "RIDER" },
      create: { ...r, passwordHash, role: "RIDER" },
    });
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: user.id, storeId } },
      update: { role: "RIDER" },
      create: { userId: user.id, storeId, role: "RIDER" },
    });
  }
}

async function seedOrders(storeId: string) {
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" }, take: DROPS.length });
  const stocked = await prisma.storeProduct.findMany({ where: { storeId, isActive: true, stock: { gt: 10 } }, take: DROPS.length * 2 });
  if (customers.length === 0 || stocked.length === 0) throw new Error("Need at least one customer and one stocked store product");

  for (const [i, drop] of DROPS.entries()) {
    const customer = customers[i % customers.length];
    const lines = [stocked[(i * 2) % stocked.length], stocked[(i * 2 + 1) % stocked.length]].map((sp, n) => ({
      sp, quantity: n + 1, total: Number(sp.price) * (n + 1),
    }));
    const totalAmount = lines.reduce((sum, l) => sum + l.total, 0);
    await prisma.order.create({
      data: {
        userId: customer.id,
        storeId,
        status: "READY",
        paymentStatus: i % 2 === 0 ? "PAID" : "PENDING",
        paymentMethod: i % 2 === 0 ? "ONLINE" : "COD",
        fulfillmentType: "DELIVERY",
        totalAmount,
        deliveryAddress: drop.address,
        deliveryPincode: drop.pincode,
        deliveryNotes: TAG,
        items: {
          create: lines.map((l) => ({
            productId: l.sp.productId, variantId: l.sp.variantId, storeProductId: l.sp.id,
            quantity: l.quantity, unitPrice: l.sp.price, totalPrice: l.total,
          })),
        },
        statusLogs: { create: [{ status: "READY", note: "Seeded for Manage delivery board" }] },
      },
    });
  }
}

async function main() {
  const store = await prisma.store.findFirst({ where: { name: "Template Store" } });
  if (!store) throw new Error("Template Store not found");
  await clearPrevious(store.id);
  await seedRiders(store.id);
  await seedOrders(store.id);
  console.log(`Seeded ${RIDERS.length} riders and ${DROPS.length} READY orders for ${store.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
