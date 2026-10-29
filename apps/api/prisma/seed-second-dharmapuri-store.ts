/**
 * A second live Dharmapuri store beside Sree Ranga Store, stocking about two thirds of its shelves at slightly
 * different prices, so store switching and cart transfer have somewhere to go. Local only; skipped when it exists.
 *
 *   cd apps/api && npx tsx prisma/seed-second-dharmapuri-store.ts
 */
import { PrismaClient, StoreSize } from "../generated/prisma/client.js";
import { createOnboarding } from "../src/services/onboarding/create.js";

const prisma = new PrismaClient();
const NAME = "Demo Kaveri Fresh";
const SOURCE_SLUG = "sreerangastore";

const source = await prisma.store.findFirst({ where: { slug: SOURCE_SLUG, town: { slug: "dharmapuri" } } });
const existing = await prisma.organization.findFirst({ where: { name: NAME } });
if (!source) {
  console.log(`No ${SOURCE_SLUG} store in Dharmapuri to copy shelves from`);
} else if (existing) {
  console.log(`${NAME} already exists`);
} else {
  const store = await createOnboarding(prisma, {
    organizationName: NAME,
    owner: { name: "Kaveri Demo Owner", phone: "9000000003" },
    upgradeShopper: false,
    store: {
      name: "Kaveri Fresh",
      address: "45 Nethaji Bypass Road, Dharmapuri, Tamil Nadu 636701",
      townId: source.townId,
      latitude: 12.1335,
      longitude: 78.135,
      deliveryRadius: 6,
      minOrderAmount: 149,
      freeDeliveryThreshold: 399,
      startingDeliveryFee: 25,
      expressEtaMinutes: 40,
      opensAt: "07:00",
      closesAt: "22:00",
    },
  });
  await prisma.store.update({
    where: { id: store.id },
    data: { status: "ACTIVE", launchedAt: new Date(), size: StoreSize.SUPERMARKET, tagline: "Fruits, vegetables and daily staples" },
  });

  const tiers = await prisma.deliveryTier.findMany({ where: { storeId: source.id } });
  await prisma.deliveryTier.createMany({
    data: tiers.map(({ id: _id, storeId: _store, createdAt: _c, updatedAt: _u, ...tier }) => ({ ...tier, storeId: store.id })),
  });

  // Every third listing stays behind, so a moved cart has something missing; the rest are within ±5%
  const listings = await prisma.storeProduct.findMany({ where: { storeId: source.id, isActive: true } });
  const kept = listings.filter((_, i) => i % 3 !== 0);
  await prisma.storeProduct.createMany({
    data: kept.map((sp, i) => ({
      storeId: store.id,
      productId: sp.productId,
      variantId: sp.variantId,
      price: Math.max(1, Math.round(Number(sp.price) * (i % 2 ? 0.95 : 1.05))),
      stock: 50,
      isActive: true,
    })),
  });
  console.log(`Created ${NAME}: ${kept.length} of ${listings.length} listings, ${tiers.length} delivery tiers`);
}
await prisma.$disconnect();
