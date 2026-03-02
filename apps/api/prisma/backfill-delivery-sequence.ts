import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * One-time backfill: set deliverySequence on orders in active trips
 * based on createdAt order within each trip.
 */
async function main() {
  const trips = await prisma.deliveryTrip.findMany({
    where: { status: { in: ["CREATED", "IN_PROGRESS"] } },
    select: { id: true },
  });

  console.log(`Found ${trips.length} active trips to backfill`);

  let updated = 0;

  for (const trip of trips) {
    const orders = await prisma.order.findMany({
      where: { deliveryTripId: trip.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, deliverySequence: true },
    });

    for (let i = 0; i < orders.length; i++) {
      if (orders[i].deliverySequence == null) {
        await prisma.order.update({
          where: { id: orders[i].id },
          data: { deliverySequence: i + 1 },
        });
        updated++;
      }
    }
  }

  console.log(`Backfilled deliverySequence on ${updated} orders`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
