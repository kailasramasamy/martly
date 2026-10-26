/**
 * Seeds realistic orders for exercising the mobile Manage persona (Today dashboard, Orders tab, order detail).
 *
 *   cd apps/api && npx tsc --noEmit -p . && npx tsx prisma/seed-manage-orders.ts
 *
 * Idempotent: every seeded order is tagged in deliveryNotes, and only tagged orders are deleted before re-creating.
 */
import { PrismaClient, type OrderStatus, type FulfillmentType, type PaymentMethod, type PaymentStatus } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const TAG = "[seed-manage-orders]";
const ACTIVE: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];
const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
const DELIVERY_FEE = 25;

interface Spec {
  status: OrderStatus;
  fulfillment: FulfillmentType;
  method: PaymentMethod;
  paid: boolean;
  minutesAgo: number;
  lines: number;
}

const HARUR: Spec[] = [
  { status: "PENDING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 2, lines: 3 },
  { status: "PENDING", fulfillment: "PICKUP", method: "ONLINE", paid: true, minutesAgo: 14, lines: 2 },
  { status: "PENDING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 41, lines: 4 },
  { status: "CONFIRMED", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 75, lines: 2 },
  { status: "PREPARING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 120, lines: 5 },
  { status: "READY", fulfillment: "PICKUP", method: "ONLINE", paid: true, minutesAgo: 180, lines: 3 },
  { status: "OUT_FOR_DELIVERY", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 240, lines: 3 },
  { status: "DELIVERED", fulfillment: "DELIVERY", method: "COD", paid: true, minutesAgo: 300, lines: 4 },
  { status: "DELIVERED", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 60 * 26, lines: 3 },
  { status: "DELIVERED", fulfillment: "PICKUP", method: "ONLINE", paid: true, minutesAgo: 60 * 24 * 3, lines: 2 },
  { status: "DELIVERED", fulfillment: "DELIVERY", method: "COD", paid: true, minutesAgo: 60 * 24 * 5, lines: 6 },
  { status: "CANCELLED", fulfillment: "DELIVERY", method: "ONLINE", paid: false, minutesAgo: 60 * 24 * 2, lines: 2 },
  // A longer live queue: several per stage, delivery and pickup mixed, for bulk actions and scrolling
  { status: "PENDING", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 5, lines: 2 },
  { status: "PENDING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 22, lines: 3 },
  { status: "PENDING", fulfillment: "PICKUP", method: "COD", paid: false, minutesAgo: 33, lines: 1 },
  { status: "CONFIRMED", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 50, lines: 4 },
  { status: "CONFIRMED", fulfillment: "PICKUP", method: "ONLINE", paid: true, minutesAgo: 65, lines: 2 },
  { status: "PREPARING", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 95, lines: 3 },
  { status: "PREPARING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 110, lines: 2 },
  { status: "READY", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 140, lines: 3 },
  { status: "READY", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 155, lines: 4 },
  { status: "READY", fulfillment: "PICKUP", method: "COD", paid: false, minutesAgo: 170, lines: 2 },
  { status: "OUT_FOR_DELIVERY", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 200, lines: 2 },
  { status: "DELIVERED", fulfillment: "DELIVERY", method: "COD", paid: true, minutesAgo: 45, lines: 3 },
];

const OTHER: Spec[] = [
  { status: "PENDING", fulfillment: "DELIVERY", method: "COD", paid: false, minutesAgo: 9, lines: 2 },
  { status: "PREPARING", fulfillment: "PICKUP", method: "ONLINE", paid: true, minutesAgo: 90, lines: 3 },
  { status: "DELIVERED", fulfillment: "DELIVERY", method: "ONLINE", paid: true, minutesAgo: 60 * 24 * 4, lines: 4 },
];

async function removePreviousSeed() {
  const old = await prisma.order.findMany({
    where: { deliveryNotes: { startsWith: TAG } },
    select: { id: true, status: true, items: { select: { storeProductId: true, quantity: true } } },
  });
  for (const order of old.filter((o) => ACTIVE.includes(o.status))) {
    for (const item of order.items) {
      await prisma.$executeRaw`UPDATE store_products SET reserved_stock = GREATEST(reserved_stock - ${item.quantity}, 0) WHERE id = ${item.storeProductId}`;
    }
  }
  const ids = old.map((o) => o.id);
  const byOrder = { orderId: { in: ids } };
  const tripIds = (await prisma.order.findMany({ where: { id: { in: ids }, deliveryTripId: { not: null } }, select: { deliveryTripId: true } }))
    .map((o) => o.deliveryTripId as string);
  // Other seeds (service) and manual testing attach records to these orders: required links go, optional ones are unlinked
  await prisma.$transaction([
    prisma.returnRequestItem.deleteMany({ where: { returnRequest: byOrder } }),
    prisma.returnRequest.deleteMany({ where: byOrder }),
    prisma.storeRating.deleteMany({ where: byOrder }),
    prisma.couponRedemption.deleteMany({ where: byOrder }),
    prisma.review.updateMany({ where: byOrder, data: { orderId: null } }),
    prisma.supportTicket.updateMany({ where: byOrder, data: { orderId: null } }),
    prisma.walletTransaction.updateMany({ where: byOrder, data: { orderId: null } }),
    prisma.loyaltyTransaction.updateMany({ where: byOrder, data: { orderId: null } }),
    prisma.orderStatusLog.deleteMany({ where: byOrder }),
    prisma.orderItem.deleteMany({ where: byOrder }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
    prisma.deliveryTrip.deleteMany({ where: { id: { in: tripIds }, orders: { none: {} } } }),
  ]);
  console.log(`Removed ${ids.length} previously seeded orders`);
}

async function createOrder(spec: Spec, index: number, storeId: string, customers: { id: string }[], stock: { id: string; productId: string; variantId: string; price: unknown }[]) {
  const picks = Array.from({ length: spec.lines }, (_, i) => stock[(index * 7 + i * 13) % stock.length]);
  const items = picks.map((sp, i) => {
    const quantity = 1 + ((index + i) % 3);
    const unitPrice = Number(sp.price);
    return { storeProductId: sp.id, productId: sp.productId, variantId: sp.variantId, quantity, unitPrice, totalPrice: unitPrice * quantity };
  });
  const fee = spec.fulfillment === "DELIVERY" ? DELIVERY_FEE : 0;
  const total = items.reduce((sum, i) => sum + i.totalPrice, 0) + fee;
  const createdAt = new Date(Date.now() - spec.minutesAgo * 60_000);
  const steps = spec.status === "CANCELLED" ? (["PENDING", "CANCELLED"] as OrderStatus[]) : FLOW.slice(0, FLOW.indexOf(spec.status) + 1);

  const order = await prisma.order.create({
    data: {
      userId: customers[index % customers.length].id,
      storeId,
      status: spec.status,
      paymentMethod: spec.method,
      paymentStatus: (spec.paid ? "PAID" : "PENDING") as PaymentStatus,
      fulfillmentType: spec.fulfillment,
      totalAmount: total,
      deliveryFee: fee,
      deliveryAddress: spec.fulfillment === "DELIVERY" ? `${12 + index}, Temple Road, Harur, Dharmapuri 636903` : "Store pickup",
      deliveryNotes: `${TAG} Demo order`,
      createdAt,
      items: { create: items },
    },
  });
  await prisma.orderStatusLog.createMany({
    data: steps.map((status, i) => ({ orderId: order.id, status, note: i === 0 ? "Order placed" : null, createdAt: new Date(createdAt.getTime() + i * 12 * 60_000) })),
  });
  if (ACTIVE.includes(spec.status)) {
    for (const item of items) {
      await prisma.$executeRaw`UPDATE store_products SET reserved_stock = reserved_stock + ${item.quantity} WHERE id = ${item.storeProductId}`;
    }
  }
}

async function seedStore(storeId: string, specs: Spec[], customers: { id: string }[]) {
  const stock = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, stock: { gte: 20 }, price: { gt: 0 } },
    orderBy: { id: "asc" },
    take: 60,
    select: { id: true, productId: true, variantId: true, price: true },
  });
  if (stock.length === 0) throw new Error(`No sellable store products for store ${storeId}`);
  for (const [i, spec] of specs.entries()) await createOrder(spec, i, storeId, customers, stock);
}

/** Orders out for delivery always ride on a started trip with a rider; seeded ones go out together with the first rider */
async function putOnTheRoad(storeId: string, organizationId: string) {
  const out = await prisma.order.findMany({ where: { storeId, status: "OUT_FOR_DELIVERY", fulfillmentType: "DELIVERY", deliveryNotes: { startsWith: TAG } }, select: { id: true } });
  const rider = await prisma.user.findFirst({ where: { role: "RIDER", userStores: { some: { storeId } } }, orderBy: { name: "asc" } });
  if (out.length === 0 || !rider) return;
  await prisma.deliveryTrip.create({
    data: {
      storeId, organizationId, riderId: rider.id, status: "IN_PROGRESS", wave: "EXPRESS", startedAt: new Date(),
      orders: { connect: out.map((o) => ({ id: o.id })) },
    },
  });
  for (const [i, o] of out.entries()) await prisma.order.update({ where: { id: o.id }, data: { deliverySequence: i + 1 } });
  console.log(`${out.length} orders out for delivery with ${rider.name}`);
}

async function main() {
  const harur = await prisma.store.findFirst({ where: { name: "Template Store" } });
  if (!harur) throw new Error("Template Store not found");
  const other = await prisma.store.findFirst({ where: { organizationId: harur.organizationId, id: { not: harur.id }, status: "ACTIVE" }, orderBy: { name: "asc" } });
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER", deletedAt: null }, orderBy: { createdAt: "asc" }, take: 6, select: { id: true } });
  if (customers.length === 0) throw new Error("No customers found");

  await removePreviousSeed();
  await seedStore(harur.id, HARUR, customers);
  await putOnTheRoad(harur.id, harur.organizationId);
  if (other) await seedStore(other.id, OTHER, customers);
  console.log(`Seeded ${HARUR.length} orders at ${harur.name}${other ? ` and ${OTHER.length} at ${other.name}` : ""}`);
}

main().finally(() => prisma.$disconnect());
