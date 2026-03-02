import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const STORE_ID = "375d5737-069b-42f0-9791-1cc8390c0993";

// Well-spread Bangalore addresses for visible polyline
const STOPS = [
  { address: "56 Indiranagar 100ft Road, Bangalore 560038", lat: 12.9784, lng: 77.6408 },
  { address: "12 Koramangala 4th Block, Bangalore 560034", lat: 12.9352, lng: 77.6245 },
  { address: "67 HSR Layout Sector 2, Bangalore 560102", lat: 12.9116, lng: 77.6389 },
  { address: "89 Jayanagar 4th T Block, Bangalore 560041", lat: 12.9250, lng: 77.5938 },
];

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function main() {
  const customer = await prisma.user.findFirst({ where: { phone: "5555555555" } });
  if (!customer) { console.error("Customer 5555555555 not found"); process.exit(1); }

  const rider = await prisma.user.findFirst({ where: { phone: "9876543221" } });
  if (!rider) { console.error("Rider 9876543221 not found"); process.exit(1); }

  const store = await prisma.store.findUnique({
    where: { id: STORE_ID },
    select: { id: true, organizationId: true, name: true, latitude: true, longitude: true },
  });
  if (!store) { console.error("Store not found"); process.exit(1); }

  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: STORE_ID, isActive: true, stock: { gt: 0 } },
    include: { product: true, variant: true },
    take: 50,
  });
  if (storeProducts.length < 3) { console.error("Not enough store products"); process.exit(1); }

  console.log(`Customer: ${customer.name}`);
  console.log(`Rider: ${rider.name} (${rider.phone})`);
  console.log(`Store: ${store.name} (${store.latitude}, ${store.longitude})`);

  // Create trip
  const trip = await prisma.deliveryTrip.create({
    data: {
      storeId: store.id,
      riderId: rider.id,
      organizationId: store.organizationId,
      status: "IN_PROGRESS",
      startedAt: minutesAgo(10),
    },
  });
  console.log(`\nTrip: ${trip.id} [IN_PROGRESS]`);

  // Create 4 orders — customer's order is stop 3 (HSR Layout)
  for (let i = 0; i < STOPS.length; i++) {
    const stop = STOPS[i];
    const items = pickRandom(storeProducts, 2 + Math.floor(Math.random() * 2));

    let totalAmount = 0;
    const orderItems = items.map((sp) => {
      const qty = 1 + Math.floor(Math.random() * 2);
      const price = Number(sp.price);
      totalAmount += price * qty;
      return {
        productId: sp.product.id,
        variantId: sp.variant.id,
        storeProductId: sp.id,
        quantity: qty,
        unitPrice: price,
        totalPrice: price * qty,
      };
    });

    const createdAt = minutesAgo(40 - i * 2);
    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        storeId: store.id,
        status: "OUT_FOR_DELIVERY",
        paymentStatus: "PAID",
        paymentMethod: "ONLINE",
        fulfillmentType: "DELIVERY",
        totalAmount,
        deliveryAddress: stop.address,
        deliveryLat: stop.lat,
        deliveryLng: stop.lng,
        deliveryTripId: trip.id,
        deliverySequence: i + 1,
        createdAt,
        items: { create: orderItems },
        statusLogs: {
          create: [
            { status: "PENDING", note: "Order placed", createdAt },
            { status: "CONFIRMED", note: "Confirmed", createdAt: new Date(createdAt.getTime() + 120000) },
            { status: "PREPARING", note: "Preparing", createdAt: new Date(createdAt.getTime() + 300000) },
            { status: "READY", note: "Ready", createdAt: new Date(createdAt.getTime() + 600000) },
            { status: "OUT_FOR_DELIVERY", note: "Trip started", createdAt: minutesAgo(10) },
          ],
        },
      },
    });

    const isYours = i === 2; // Stop 3 is the customer's focus order
    console.log(`  Stop ${i + 1}: ${order.id} — ${stop.address.split(",")[0]}${isYours ? " ← YOUR ORDER" : ""}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TESTING:");
  console.log(`1. Open live tracking for any of the orders above`);
  console.log(`2. Push rider location near the store:`);
  console.log(`   curl -X POST http://localhost:7001/api/v1/rider-location \\`);
  console.log(`     -H "Authorization: Bearer <RIDER_TOKEN>" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"tripId":"${trip.id}","lat":${store.latitude},"lng":${store.longitude}}'`);
  console.log(`\nRider phone: ${rider.phone} (OTP: 111111)`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
