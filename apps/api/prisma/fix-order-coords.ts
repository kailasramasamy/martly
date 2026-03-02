import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const addressCoords = [
  { match: "jayanagar", lat: 12.925, lng: 77.5938 },
  { match: "whitefield", lat: 12.9698, lng: 77.75 },
  { match: "indiranagar", lat: 12.9784, lng: 77.6408 },
  { match: "koramangala", lat: 12.9352, lng: 77.6245 },
  { match: "hsr layout", lat: 12.9116, lng: 77.6389 },
  { match: "btm layout", lat: 12.9166, lng: 77.6101 },
  { match: "marathahalli", lat: 12.9591, lng: 77.6974 },
  { match: "electronic city", lat: 12.8399, lng: 77.677 },
  { match: "jp nagar", lat: 12.9063, lng: 77.5857 },
  { match: "bannerghatta", lat: 12.8877, lng: 77.5963 },
  { match: "mg road", lat: 12.9756, lng: 77.606 },
  { match: "malleshwaram", lat: 12.9969, lng: 77.5705 },
  { match: "rajajinagar", lat: 12.9878, lng: 77.5528 },
];

async function main() {
  const orders = await prisma.order.findMany({
    where: { deliveryAddress: { not: null } },
    select: { id: true, deliveryAddress: true, deliveryLat: true, deliveryLng: true },
  });

  let updated = 0;
  for (const order of orders) {
    if (!order.deliveryAddress) continue;
    const addr = order.deliveryAddress.toLowerCase();
    const match = addressCoords.find((c) => addr.includes(c.match));
    if (match) {
      // Small random offset so pins don't stack
      const latOffset = (Math.random() - 0.5) * 0.003;
      const lngOffset = (Math.random() - 0.5) * 0.003;
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryLat: match.lat + latOffset, deliveryLng: match.lng + lngOffset },
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} orders with area-accurate coordinates`);

  // Verify active trip
  const trip = await prisma.deliveryTrip.findFirst({
    where: { status: "IN_PROGRESS" },
    include: {
      store: { select: { name: true, latitude: true, longitude: true } },
      orders: {
        select: {
          deliveryAddress: true,
          deliveryLat: true,
          deliveryLng: true,
          user: { select: { name: true } },
        },
      },
    },
  });
  if (trip) {
    console.log("\nActive trip verification:");
    console.log(`Store: ${trip.store.latitude}, ${trip.store.longitude}`);
    for (const o of trip.orders) {
      const area = o.deliveryAddress?.split(",")[0] ?? "?";
      console.log(`  ${area} -> ${o.deliveryLat?.toFixed(4)}, ${o.deliveryLng?.toFixed(4)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
