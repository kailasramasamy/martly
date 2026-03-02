import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Find Bigmart store
  const bigmart = await prisma.store.findFirst({
    where: { slug: "bigmart" },
    select: { id: true, organizationId: true, name: true },
  });
  if (!bigmart) {
    console.log("Bigmart store not found. Run the main seed first.");
    return;
  }
  console.log(`Found store: ${bigmart.name} (${bigmart.id})`);

  const passwordHash = await bcrypt.hash("rider123", 10);

  const riders = [
    { email: "raju@martly.dev", name: "Raju Rider", phone: "9876543220" },
    { email: "vikram@martly.dev", name: "Vikram Delivery", phone: "9876543221" },
    { email: "suresh@martly.dev", name: "Suresh Express", phone: "9876543222" },
  ];

  for (const rider of riders) {
    const user = await prisma.user.upsert({
      where: { email: rider.email },
      create: {
        email: rider.email,
        name: rider.name,
        phone: rider.phone,
        passwordHash,
        role: "STAFF",
      },
      update: {
        name: rider.name,
        phone: rider.phone,
        role: "STAFF",
      },
    });

    // Assign to Bigmart via UserStore
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: user.id, storeId: bigmart.id } },
      create: { userId: user.id, storeId: bigmart.id, role: "STAFF" },
      update: {},
    });

    console.log(`  Rider: ${rider.name} (${user.id}) assigned to ${bigmart.name}`);
  }

  console.log("\nDone! Seeded 3 riders for Bigmart store.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
