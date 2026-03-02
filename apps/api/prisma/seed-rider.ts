import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Find Bigmart store and its org
  const store = await prisma.store.findFirst({
    where: { name: { contains: "Bigmart", mode: "insensitive" } },
    select: { id: true, organizationId: true, name: true },
  });

  if (!store) {
    console.error("Bigmart store not found. Run base seeds first.");
    process.exit(1);
  }

  console.log(`Found store: ${store.name} (${store.id})`);

  // Create rider users
  const riders = [
    { name: "Ravi Kumar", email: "rider1@martly.dev", phone: "9876543210", password: "rider123" },
    { name: "Suresh Babu", email: "rider2@martly.dev", phone: "9876543211", password: "rider123" },
  ];

  for (const rider of riders) {
    const existing = await prisma.user.findUnique({ where: { email: rider.email } });
    if (existing) {
      console.log(`Rider ${rider.name} already exists (${existing.id})`);
      // Ensure UserStore link exists
      const link = await prisma.userStore.findUnique({
        where: { userId_storeId: { userId: existing.id, storeId: store.id } },
      });
      if (!link) {
        await prisma.userStore.create({
          data: { userId: existing.id, storeId: store.id },
        });
        console.log(`  Linked to ${store.name}`);
      }
      continue;
    }

    const passwordHash = await bcrypt.hash(rider.password, 10);
    const user = await prisma.user.create({
      data: {
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        passwordHash,
        role: "STAFF",
      },
    });

    // Link to store
    await prisma.userStore.create({
      data: { userId: user.id, storeId: store.id },
    });

    console.log(`Created rider: ${rider.name} (${user.id}) → ${store.name}`);
  }

  console.log("\nRider credentials:");
  console.log("  rider1@martly.dev / rider123");
  console.log("  rider2@martly.dev / rider123");
  console.log("  Phone: 9876543210, OTP: 111111");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
