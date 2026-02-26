/**
 * Seed script: Set Bigmart store coordinates and create delivery tiers
 *
 * Usage: npx tsx prisma/seed-delivery-tiers.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Find the Bigmart store
  const bigmart = await prisma.store.findFirst({
    where: { slug: "bigmart" },
  });

  if (!bigmart) {
    console.log("Bigmart store not found. Trying first active store...");
    const anyStore = await prisma.store.findFirst({ where: { status: "ACTIVE" } });
    if (!anyStore) {
      console.log("No active store found. Please seed stores first.");
      return;
    }
    console.log(`Using store: ${anyStore.name} (${anyStore.id})`);
    await seedStoreDelivery(anyStore.id, anyStore.name);
  } else {
    console.log(`Found Bigmart: ${bigmart.id}`);
    await seedStoreDelivery(bigmart.id, bigmart.name);
  }
}

async function seedStoreDelivery(storeId: string, storeName: string) {
  // Set store coordinates (Koramangala, Bangalore — a common demo location)
  await prisma.store.update({
    where: { id: storeId },
    data: {
      latitude: 12.9352,
      longitude: 77.6245,
      deliveryRadius: 7,
    },
  });
  console.log(`✓ Set ${storeName} location: 12.9352, 77.6245 (Koramangala, Bangalore)`);
  console.log(`✓ Set delivery radius: 7 km`);

  // Delete existing tiers for this store
  const deleted = await prisma.deliveryTier.deleteMany({ where: { storeId } });
  if (deleted.count > 0) {
    console.log(`  Removed ${deleted.count} existing tier(s)`);
  }

  // Create 3 delivery tiers
  const tiers = [
    { storeId, minDistance: 0, maxDistance: 3, deliveryFee: 0, estimatedMinutes: 30, isActive: true },
    { storeId, minDistance: 3, maxDistance: 5, deliveryFee: 20, estimatedMinutes: 45, isActive: true },
    { storeId, minDistance: 5, maxDistance: 7, deliveryFee: 40, estimatedMinutes: 60, isActive: true },
  ];

  for (const tier of tiers) {
    await prisma.deliveryTier.create({ data: tier });
    const feeStr = tier.deliveryFee === 0 ? "FREE" : `₹${tier.deliveryFee}`;
    console.log(`✓ Tier: ${tier.minDistance}–${tier.maxDistance} km → ${feeStr}, ${tier.estimatedMinutes} min`);
  }

  // Also set coordinates for the test customer address
  const customerUser = await prisma.user.findFirst({
    where: { email: "customer@martly.dev" },
  });

  if (customerUser) {
    // Update or create a test address with coordinates (Indiranagar — ~2km from Koramangala)
    const existingAddr = await prisma.userAddress.findFirst({
      where: { userId: customerUser.id },
      orderBy: { isDefault: "desc" },
    });

    if (existingAddr) {
      await prisma.userAddress.update({
        where: { id: existingAddr.id },
        data: {
          latitude: 12.9716,
          longitude: 77.6412,
          pincode: "560038",
        },
      });
      console.log(`\n✓ Updated customer address with coordinates (Indiranagar: 12.9716, 77.6412)`);
    } else {
      await prisma.userAddress.create({
        data: {
          userId: customerUser.id,
          label: "Home",
          address: "100 Indiranagar, Bangalore 560038",
          latitude: 12.9716,
          longitude: 77.6412,
          pincode: "560038",
          isDefault: true,
        },
      });
      console.log(`\n✓ Created customer address with coordinates (Indiranagar: 12.9716, 77.6412)`);
    }
  }

  console.log("\n✅ Delivery tier seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
