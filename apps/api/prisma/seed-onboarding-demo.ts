/**
 * A store half-way through onboarding (details in, size chosen, no catalog yet), so the wizard opens with data.
 * Local only; skipped when the demo business already exists.
 *
 *   cd apps/api && npx tsx prisma/seed-onboarding-demo.ts
 */
import { PrismaClient, StoreSize } from "../generated/prisma/client.js";
import { createOnboarding, updateOnboarding } from "../src/services/onboarding/create.js";

const prisma = new PrismaClient();
const NAME = "Demo Sree Ranga Stores";

const existing = await prisma.organization.findFirst({ where: { name: NAME } });
const town = await prisma.town.upsert({
  where: { slug: "harur" },
  update: {},
  create: { slug: "harur", name: "Harur", district: "Dharmapuri", state: "Tamil Nadu" },
});
if (existing) {
  console.log(`${NAME} already exists; open it from Onboard store`);
} else {
  const store = await createOnboarding(prisma, {
    organizationName: NAME,
    owner: { name: "Ranga Demo Owner", phone: "9000000002" },
    upgradeShopper: false,
    store: {
      name: "Sree Ranga Supermarket",
      address: "12 Car Street, Harur, Tamil Nadu 636903",
      townId: town.id,
      latitude: 12.0512,
      longitude: 78.4821,
      deliveryRadius: 5,
      minOrderAmount: 99,
      freeDeliveryThreshold: 299,
      startingDeliveryFee: 20,
      expressEtaMinutes: 30,
      opensAt: "07:00",
      closesAt: "21:30",
    },
  });
  await updateOnboarding(prisma, store.id, { size: StoreSize.SUPERMARKET });
  console.log(`Created ${NAME}: http://localhost:7000/onboarding/${store.id}`);
}
await prisma.$disconnect();
