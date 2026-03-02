import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const STORE_ID = "375d5737-069b-42f0-9791-1cc8390c0993";

const ADDRESSES = [
  { address: "123 MG Road, Bangalore 560001", lat: 12.9758, lng: 77.6045 },
  { address: "45 Brigade Road, Bangalore 560025", lat: 12.9716, lng: 77.6070 },
  { address: "78 Residency Road, Bangalore 560025", lat: 12.9690, lng: 77.6050 },
  { address: "12 Koramangala 4th Block, Bangalore 560034", lat: 12.9352, lng: 77.6245 },
  { address: "56 Indiranagar 100ft Road, Bangalore 560038", lat: 12.9719, lng: 77.6412 },
  { address: "89 Jayanagar 4th T Block, Bangalore 560041", lat: 12.9250, lng: 77.5938 },
  { address: "34 Whitefield Main Road, Bangalore 560066", lat: 12.9698, lng: 77.7500 },
  { address: "67 HSR Layout Sector 2, Bangalore 560102", lat: 12.9116, lng: 77.6389 },
  { address: "91 Bannerghatta Road, Bangalore 560076", lat: 12.8900, lng: 77.5970 },
  { address: "22 Malleshwaram 8th Cross, Bangalore 560003", lat: 12.9965, lng: 77.5713 },
];

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function main() {
  // 1. Find the customer with phone 5555555555
  const customer = await prisma.user.findFirst({
    where: { phone: "5555555555" },
  });
  if (!customer) {
    console.error("Customer with phone 5555555555 not found.");
    process.exit(1);
  }
  console.log(`Found customer: ${customer.name} (${customer.id})`);

  // 2. Find the rider with phone 9876543210
  const rider = await prisma.user.findFirst({
    where: { phone: "9876543210" },
  });
  if (!rider) {
    console.error("Rider with phone 9876543210 not found.");
    process.exit(1);
  }
  console.log(`Found rider: ${rider.name} (${rider.id})`);

  // 3. Find the Bigmart store
  const store = await prisma.store.findUnique({
    where: { id: STORE_ID },
    select: { id: true, organizationId: true, name: true },
  });
  if (!store) {
    console.error(`Store ${STORE_ID} not found.`);
    process.exit(1);
  }
  console.log(`Found store: ${store.name} (${store.id})`);

  // 4. Get active store products
  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: STORE_ID, isActive: true, stock: { gt: 0 } },
    include: {
      product: true,
      variant: true,
    },
    take: 100,
  });
  if (storeProducts.length < 4) {
    console.error(`Only ${storeProducts.length} active store products found. Need at least 4.`);
    process.exit(1);
  }
  console.log(`Found ${storeProducts.length} active store products`);

  // Trip definitions
  const tripDefs = [
    { name: "Trip 1", status: "CREATED" as const, orderCount: 4, orderStatus: "READY" as const, startedAt: null },
    { name: "Trip 2", status: "IN_PROGRESS" as const, orderCount: 3, orderStatus: "OUT_FOR_DELIVERY" as const, startedAt: minutesAgo(15) },
    { name: "Trip 3", status: "CREATED" as const, orderCount: 3, orderStatus: "READY" as const, startedAt: null },
  ];

  const results: { tripId: string; tripName: string; tripStatus: string; orders: { id: string; status: string; address: string }[] }[] = [];
  let addressIdx = 0;

  for (const tripDef of tripDefs) {
    // Create the delivery trip
    const trip = await prisma.deliveryTrip.create({
      data: {
        storeId: store.id,
        riderId: rider.id,
        organizationId: store.organizationId,
        status: tripDef.status,
        startedAt: tripDef.startedAt,
      },
    });
    console.log(`\nCreated ${tripDef.name}: ${trip.id} (${tripDef.status})`);

    const tripOrders: { id: string; status: string; address: string }[] = [];

    for (let i = 0; i < tripDef.orderCount; i++) {
      // Pick 2-4 random products
      const itemCount = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
      const selectedProducts = pickRandom(storeProducts, itemCount);

      let totalAmount = 0;
      const items = selectedProducts.map((sp) => {
        const quantity = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
        const unitPrice = Number(sp.price);
        const total = unitPrice * quantity;
        totalAmount += total;
        return {
          productId: sp.product.id,
          variantId: sp.variant.id,
          storeProductId: sp.id,
          quantity,
          unitPrice,
          totalPrice: total,
        };
      });

      const paymentMethod = Math.random() > 0.5 ? "ONLINE" : "COD";
      const paymentStatus = paymentMethod === "ONLINE" ? "PAID" : "PENDING";
      const addrEntry = ADDRESSES[addressIdx % ADDRESSES.length];
      const address = addrEntry.address;
      addressIdx++;

      // Status log entries depend on order status
      const statusTransitions: { status: string; note: string; createdAt: Date }[] = [];
      const orderCreatedAt = minutesAgo(30 + Math.floor(Math.random() * 30)); // 30-60 minutes ago

      statusTransitions.push({ status: "PENDING", note: "Order placed", createdAt: orderCreatedAt });
      statusTransitions.push({ status: "CONFIRMED", note: "Order confirmed by store", createdAt: new Date(orderCreatedAt.getTime() + 2 * 60 * 1000) });
      statusTransitions.push({ status: "PREPARING", note: "Store is preparing order", createdAt: new Date(orderCreatedAt.getTime() + 5 * 60 * 1000) });
      statusTransitions.push({ status: "READY", note: "Order ready for pickup", createdAt: new Date(orderCreatedAt.getTime() + 12 * 60 * 1000) });

      if (tripDef.orderStatus === "OUT_FOR_DELIVERY") {
        statusTransitions.push({ status: "OUT_FOR_DELIVERY", note: "Rider picked up the order", createdAt: minutesAgo(15) });
      }

      const order = await prisma.order.create({
        data: {
          userId: customer.id,
          storeId: store.id,
          status: tripDef.orderStatus,
          paymentStatus: paymentStatus as any,
          paymentMethod: paymentMethod as any,
          fulfillmentType: "DELIVERY",
          totalAmount,
          deliveryAddress: address,
          deliveryLat: addrEntry.lat,
          deliveryLng: addrEntry.lng,
          deliveryTripId: trip.id,
          deliverySequence: i + 1,
          items: { create: items },
          statusLogs: {
            create: statusTransitions.map((t) => ({
              status: t.status as any,
              note: t.note,
              createdAt: t.createdAt,
            })),
          },
        },
      });

      tripOrders.push({ id: order.id, status: tripDef.orderStatus, address });
      console.log(`  Order ${order.id} — ${tripDef.orderStatus} — ${paymentMethod} — ${address}`);
    }

    results.push({
      tripId: trip.id,
      tripName: tripDef.name,
      tripStatus: tripDef.status,
      orders: tripOrders,
    });
  }

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("SEED SUMMARY");
  console.log("=".repeat(80));
  console.log(`Customer: ${customer.name} (${customer.id})`);
  console.log(`Rider: ${rider.name} (${rider.id})`);
  console.log(`Store: ${store.name} (${store.id})`);
  console.log("");

  for (const trip of results) {
    console.log(`${trip.tripName}: ${trip.tripId} [${trip.tripStatus}]`);
    for (const order of trip.orders) {
      console.log(`  Order: ${order.id} [${order.status}] — ${order.address}`);
    }
    console.log("");
  }

  console.log(`Total: ${results.length} trips, ${results.reduce((sum, t) => sum + t.orders.length, 0)} orders`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
