import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Find Bigmart store
  const store = await prisma.store.findFirst({
    where: { slug: "bigmart" },
  });

  if (!store) {
    console.log("Bigmart store not found — skipping seed");
    return;
  }

  const config = await prisma.expressDeliveryConfig.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      isEnabled: true,
      etaMinutes: 30,
      operatingStart: "08:00",
      operatingEnd: "22:00",
    },
    update: {
      isEnabled: true,
      etaMinutes: 30,
      operatingStart: "08:00",
      operatingEnd: "22:00",
    },
  });

  console.log(`Express delivery config seeded for ${store.name}:`, {
    id: config.id,
    isEnabled: config.isEnabled,
    etaMinutes: config.etaMinutes,
    operatingStart: config.operatingStart,
    operatingEnd: config.operatingEnd,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
