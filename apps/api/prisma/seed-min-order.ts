import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const storeId = "375d5737-069b-42f0-9791-1cc8390c0993"; // Bigmart

  const store = await prisma.store.update({
    where: { id: storeId },
    data: {
      minOrderAmount: 199,
      baseDeliveryFee: 30,
      freeDeliveryThreshold: 499,
    },
  });

  console.log(`Updated ${store.name}:`);
  console.log(`  minOrderAmount: ₹${store.minOrderAmount}`);
  console.log(`  baseDeliveryFee: ₹${store.baseDeliveryFee}`);
  console.log(`  freeDeliveryThreshold: ₹${store.freeDeliveryThreshold}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
