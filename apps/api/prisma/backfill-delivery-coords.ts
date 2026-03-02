import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const COORDS: Record<string, { lat: number; lng: number }> = {
  "123 MG Road, Bangalore 560001": { lat: 12.9758, lng: 77.6045 },
  "45 Brigade Road, Bangalore 560025": { lat: 12.9716, lng: 77.6070 },
  "78 Residency Road, Bangalore 560025": { lat: 12.9690, lng: 77.6050 },
  "12 Koramangala 4th Block, Bangalore 560034": { lat: 12.9352, lng: 77.6245 },
  "56 Indiranagar 100ft Road, Bangalore 560038": { lat: 12.9719, lng: 77.6412 },
  "89 Jayanagar 4th T Block, Bangalore 560041": { lat: 12.9250, lng: 77.5938 },
  "34 Whitefield Main Road, Bangalore 560066": { lat: 12.9698, lng: 77.7500 },
  "67 HSR Layout Sector 2, Bangalore 560102": { lat: 12.9116, lng: 77.6389 },
  "91 Bannerghatta Road, Bangalore 560076": { lat: 12.8900, lng: 77.5970 },
  "22 Malleshwaram 8th Cross, Bangalore 560003": { lat: 12.9965, lng: 77.5713 },
};

async function main() {
  const orders = await prisma.order.findMany({
    where: { deliveryLat: null, deliveryAddress: { not: null } },
    select: { id: true, deliveryAddress: true },
  });

  let updated = 0;
  for (const order of orders) {
    const coords = COORDS[order.deliveryAddress ?? ""];
    if (coords) {
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryLat: coords.lat, deliveryLng: coords.lng },
      });
      updated++;
    }
  }
  console.log(`Updated delivery coords on ${updated} orders`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
