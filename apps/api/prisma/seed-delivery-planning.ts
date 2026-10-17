/**
 * Sets Harur Fresh Mart up for delivery planning: two slots a day (10–12, 17–19), a rider roster on both,
 * fleet settings, and slot orders spread over four neighbourhoods (with coordinates) for today's evening slot
 * and tomorrow's morning slot.
 *
 *   cd apps/api && npx tsx prisma/seed-delivery-planning.ts
 *   --slots-only sets up slots, roster and fleet settings without test orders (for production)
 *
 * Idempotent: seeded orders are tagged in deliveryNotes and replaced on every run, along with any trips holding them.
 * The old all-day slots are switched off, not deleted. Needs seed-manage-users.ts (riders) first.
 */
import { PrismaClient, type OrderStatus } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const TAG = "[seed-delivery-planning]";
const SLOTS = [{ startTime: "10:00", endTime: "12:00" }, { startTime: "17:00", endTime: "19:00" }];
const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

// Neighbourhoods around the store (12.244, 78.269), roughly 1–3 km out in four directions
const AREAS = [
  { street: "Temple Road", dLat: 0.012, dLng: 0.002 },
  { street: "Bus Stand Road", dLat: 0.002, dLng: 0.014 },
  { street: "Kottapatti Main Road", dLat: -0.015, dLng: -0.003 },
  { street: "Morappur Road", dLat: -0.001, dLng: -0.016 },
];

// Today's evening slot: 14 orders, mostly packed; tomorrow morning: 5 just placed
const TODAY: OrderStatus[] = ["READY", "READY", "READY", "PREPARING", "READY", "READY", "CONFIRMED", "READY", "READY", "PREPARING", "READY", "READY", "READY", "READY"];
const TOMORROW: OrderStatus[] = ["CONFIRMED", "PENDING", "CONFIRMED", "PENDING", "CONFIRMED"];

const istKey = (offsetDays: number) => new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

async function removePreviousSeed() {
  const old = await prisma.order.findMany({ where: { deliveryNotes: { startsWith: TAG } }, select: { id: true, status: true, deliveryTripId: true, items: { select: { storeProductId: true, quantity: true } } } });
  for (const order of old) {
    for (const item of order.items) {
      await prisma.$executeRaw`UPDATE store_products SET reserved_stock = GREATEST(reserved_stock - ${item.quantity}, 0) WHERE id = ${item.storeProductId}`;
    }
  }
  const ids = old.map((o) => o.id);
  const tripIds = [...new Set(old.map((o) => o.deliveryTripId).filter((t): t is string => !!t))];
  await prisma.$transaction([
    prisma.orderStatusLog.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
    prisma.deliveryTrip.deleteMany({ where: { id: { in: tripIds }, orders: { none: {} } } }),
  ]);
  console.log(`Removed ${ids.length} previously seeded orders`);
}

/** Two slots every day; the old all-day slots stay but are switched off */
async function seedSlots(storeId: string) {
  const keep = new Set(SLOTS.map((s) => `${s.startTime}-${s.endTime}`));
  const existing = await prisma.deliverySlot.findMany({ where: { storeId } });
  for (const slot of existing.filter((s) => !keep.has(`${s.startTime}-${s.endTime}`))) {
    await prisma.deliverySlot.update({ where: { id: slot.id }, data: { isActive: false } });
  }
  for (let day = 0; day < 7; day++) {
    for (const s of SLOTS) {
      await prisma.deliverySlot.upsert({
        where: { storeId_dayOfWeek_startTime_endTime: { storeId, dayOfWeek: day, ...s } },
        create: { storeId, dayOfWeek: day, ...s, maxOrders: 40, cutoffMinutes: 60 },
        update: { isActive: true, maxOrders: 40, cutoffMinutes: 60 },
      });
    }
  }
}

async function seedRoster(storeId: string) {
  const riders = await prisma.user.findMany({ where: { role: "RIDER", userStores: { some: { storeId } } }, select: { id: true, name: true } });
  const slots = await prisma.deliverySlot.findMany({ where: { storeId, isActive: true } });
  for (const slot of slots) {
    for (const rider of riders) {
      await prisma.slotRider.upsert({ where: { slotId_riderId: { slotId: slot.id, riderId: rider.id } }, create: { slotId: slot.id, riderId: rider.id }, update: {} });
    }
  }
  await prisma.storeDeliverySettings.upsert({
    where: { storeId },
    create: { storeId, maxOrdersPerTrip: 6, maxTripsPerRider: 2, expressBatchSize: 3, expressMaxWaitMinutes: 10, autoPlan: false },
    update: { maxOrdersPerTrip: 6, maxTripsPerRider: 2, expressBatchSize: 3, expressMaxWaitMinutes: 10 },
  });
  console.log(`Roster: ${riders.map((r) => r.name).join(", ")} on ${slots.length} slots`);
}

type Stock = { id: string; productId: string; variantId: string; price: unknown };

async function createSlotOrder(args: { storeId: string; slotId: string; dateKey: string; slot: (typeof SLOTS)[number]; status: OrderStatus; index: number; customers: { id: string }[]; stock: Stock[]; origin: { lat: number; lng: number } }) {
  const { storeId, slotId, dateKey, slot, status, index, customers, stock, origin } = args;
  const area = AREAS[index % AREAS.length];
  // Spread houses a few hundred metres apart within the neighbourhood
  const jitter = (n: number) => ((n * 37) % 9 - 4) * 0.0008;
  const picks = Array.from({ length: 2 + (index % 3) }, (_, i) => stock[(index * 7 + i * 13) % stock.length]);
  const items = picks.map((sp, i) => ({ storeProductId: sp.id, productId: sp.productId, variantId: sp.variantId, quantity: 1 + ((index + i) % 2), unitPrice: Number(sp.price), totalPrice: Number(sp.price) * (1 + ((index + i) % 2)) }));
  const total = items.reduce((sum, i) => sum + i.totalPrice, 0) + 25;
  const order = await prisma.order.create({
    data: {
      userId: customers[index % customers.length].id, storeId, status, fulfillmentType: "DELIVERY",
      paymentMethod: index % 3 === 0 ? "ONLINE" : "COD", paymentStatus: index % 3 === 0 ? "PAID" : "PENDING",
      totalAmount: total, deliveryFee: 25,
      deliveryAddress: `${10 + index}, ${area.street}, Harur, Dharmapuri 636903`, deliveryPincode: "636903",
      deliveryLat: origin.lat + area.dLat + jitter(index), deliveryLng: origin.lng + area.dLng + jitter(index + 3),
      deliveryNotes: `${TAG} ${index % 4 === 1 ? "Call before arriving, gate is locked" : "Demo slot order"}`,
      deliverySlotId: slotId, scheduledDate: new Date(`${dateKey}T00:00:00+05:30`),
      slotStartTime: slot.startTime, slotEndTime: slot.endTime, estimatedDeliveryAt: new Date(`${dateKey}T${slot.startTime}:00+05:30`),
      items: { create: items },
    },
  });
  await prisma.orderStatusLog.createMany({ data: FLOW.slice(0, FLOW.indexOf(status) + 1).map((s) => ({ orderId: order.id, status: s })) });
  for (const item of items) await prisma.$executeRaw`UPDATE store_products SET reserved_stock = reserved_stock + ${item.quantity} WHERE id = ${item.storeProductId}`;
}

async function seedOrders(storeId: string, origin: { lat: number; lng: number }) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { organizationId: true } });
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER", orders: { some: { store: { organizationId: store.organizationId } } } }, take: 4, select: { id: true } });
  const stock = await prisma.storeProduct.findMany({ where: { storeId, isActive: true, stock: { gte: 20 }, price: { gt: 0 } }, take: 60, orderBy: { id: "asc" }, select: { id: true, productId: true, variantId: true, price: true } });
  const waves = [{ dateKey: istKey(0), slot: SLOTS[1], statuses: TODAY }, { dateKey: istKey(1), slot: SLOTS[0], statuses: TOMORROW }];
  for (const wave of waves) {
    const slotRow = await prisma.deliverySlot.findUniqueOrThrow({ where: { storeId_dayOfWeek_startTime_endTime: { storeId, dayOfWeek: weekday(wave.dateKey), ...wave.slot } } });
    for (const [index, status] of wave.statuses.entries()) {
      await createSlotOrder({ storeId, slotId: slotRow.id, dateKey: wave.dateKey, slot: wave.slot, status, index, customers, stock, origin });
    }
    console.log(`${wave.statuses.length} orders for ${wave.dateKey} ${wave.slot.startTime}–${wave.slot.endTime}`);
  }
}

async function main() {
  const harur = await prisma.store.findFirstOrThrow({ where: { name: "Harur Fresh Mart" }, select: { id: true, latitude: true, longitude: true } });
  const slotsOnly = process.argv.includes("--slots-only");
  if (!slotsOnly) await removePreviousSeed();
  await seedSlots(harur.id);
  await seedRoster(harur.id);
  if (slotsOnly) return;
  await seedOrders(harur.id, { lat: harur.latitude ?? 12.244, lng: harur.longitude ?? 78.269 });
}

main().finally(() => prisma.$disconnect());
