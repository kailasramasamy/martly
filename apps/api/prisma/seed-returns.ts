/**
 * Seeds returns in every state for the OTP review customer at Template Store, plus orders to test them with:
 * a fresh delivery to raise a new return on, and an order out with rider@martly.in that carries a pickup.
 *
 *   cd apps/api && npx tsx prisma/seed-returns.ts [phone]
 *
 * The phone defaults to OTP_REVIEW_PHONE; pass your own to test as yourself.
 * Needs the OTP review customer (log in once with OTP_REVIEW_PHONE) and seed-manage-users.ts for the rider.
 * Re-running removes the previous [returns-seed] orders first.
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const TAG = "[returns-seed]";
const RETURN_IMAGE = "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=400&fit=crop";
const HOUR = 60 * 60 * 1000;

type Line = { id: string; productId: string; variantId: string; price: Prisma.Decimal };

async function makeOrder(userId: string, storeId: string, lines: Line[], status: "DELIVERED" | "OUT_FOR_DELIVERY", at: Date, tripId?: string) {
  const items = lines.map((l, i) => ({ productId: l.productId, variantId: l.variantId, storeProductId: l.id, quantity: i + 1, unitPrice: l.price, totalPrice: Number(l.price) * (i + 1) }));
  const total = items.reduce((s, i) => s + i.totalPrice, 0);
  const order = await prisma.order.create({
    data: {
      userId, storeId, status, totalAmount: total, paymentMethod: "COD", paymentStatus: status === "DELIVERED" ? "PAID" : "PENDING",
      deliveryAddress: "12 Temple Road, Harur", deliveryPincode: "636903", deliveryNotes: TAG, deliveryTripId: tripId, deliverySequence: tripId ? 1 : undefined,
      createdAt: at, items: { create: items },
      statusLogs: { create: [{ status: "PENDING", createdAt: at }, { status, createdAt: new Date(at.getTime() + HOUR) }] },
    },
    include: { items: true },
  });
  // Out-for-delivery stock is still reserved
  if (status === "OUT_FOR_DELIVERY") {
    for (const i of items) await prisma.storeProduct.update({ where: { id: i.storeProductId }, data: { reservedStock: { increment: i.quantity } } });
  }
  return order;
}

async function clearPrevious() {
  const old = await prisma.order.findMany({ where: { deliveryNotes: TAG }, select: { id: true, status: true, items: true } });
  const ids = old.map((o) => o.id);
  for (const o of old.filter((o) => o.status === "OUT_FOR_DELIVERY")) {
    for (const i of o.items) await prisma.$executeRaw`UPDATE store_products SET reserved_stock = GREATEST(reserved_stock - ${i.quantity}, 0) WHERE id = ${i.storeProductId}`;
  }
  await prisma.returnRequest.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderStatusLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.stockMovement.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
  await prisma.walletTransaction.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.deliveryTrip.deleteMany({ where: { areaLabel: TAG } });
}

async function seedReturn(order: { id: string; userId: string; items: { id: string; quantity: number; unitPrice: Prisma.Decimal }[] }, storeId: string, organizationId: string, plan: Partial<Prisma.ReturnRequestUncheckedCreateInput>, restock = false) {
  const item = order.items[0];
  const amount = Number(item.unitPrice) * item.quantity;
  await prisma.returnRequest.create({
    data: {
      orderId: order.id, userId: order.userId, storeId, organizationId, reason: "Wrong item received", description: `${TAG} Got a different brand`,
      images: [RETURN_IMAGE], requestedAmount: amount, approvedAmount: amount, resolvedAt: new Date(), status: "IN_PROGRESS", ...plan,
      items: { create: [{ orderItemId: item.id, quantity: item.quantity, restock }] },
    },
  });
}

async function main() {
  const store = await prisma.store.findFirstOrThrow({ where: { name: "Template Store" } });
  const customer = await prisma.user.findFirstOrThrow({ where: { phone: process.argv[2] ?? process.env.OTP_REVIEW_PHONE } });
  const rider = await prisma.user.findUniqueOrThrow({ where: { email: "rider@martly.in" } });
  await clearPrevious();
  await prisma.store.update({ where: { id: store.id }, data: { returnKeepThreshold: 150 } });

  const stocked = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true, stock: { gte: 20 }, price: { gte: 40, lte: 400 } },
    select: { id: true, productId: true, variantId: true, price: true }, take: 12, orderBy: { id: "asc" },
  });
  if (stocked.length < 12) throw new Error("Not enough stocked products at Template Store");
  const lines = (n: number) => stocked.slice(n * 2, n * 2 + 2);
  const ago = (hours: number) => new Date(Date.now() - hours * HOUR);
  const { organizationId } = store;

  const fresh = await makeOrder(customer.id, store.id, lines(0), "DELIVERED", ago(3));
  const collect = await makeOrder(customer.id, store.id, lines(1), "DELIVERED", ago(30));
  const drop = await makeOrder(customer.id, store.id, lines(2), "DELIVERED", ago(30));
  const replace = await makeOrder(customer.id, store.id, lines(3), "DELIVERED", ago(30));
  const pending = await makeOrder(customer.id, store.id, lines(4), "DELIVERED", ago(20));

  await seedReturn(collect, store.id, organizationId, { remedy: "REFUND", method: "NEXT_ORDER" }, true);
  await seedReturn(drop, store.id, organizationId, { remedy: "REFUND", method: "AT_STORE" }, true);
  await seedReturn(replace, store.id, organizationId, { remedy: "REPLACE", method: "KEEP", reason: "Damaged/broken item" });
  await seedReturn(pending, store.id, organizationId, { status: "PENDING", approvedAmount: null, resolvedAt: null, reason: "Item expired/stale" });

  const trip = await prisma.deliveryTrip.create({
    data: { storeId: store.id, organizationId, riderId: rider.id, status: "IN_PROGRESS", areaLabel: TAG, startedAt: new Date() },
  });
  const onTheWay = await makeOrder(customer.id, store.id, lines(5), "OUT_FOR_DELIVERY", ago(1), trip.id);

  console.log(`Fresh delivery to return: ${fresh.id}`);
  console.log(`Out with rider (carries the pickup): ${onTheWay.id} on trip ${trip.id}`);
  console.log("Returns: collect with next order, drop at store, replacement, pending");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
