import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating test users for role-based testing...\n");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ── Ensure Demo Grocers org + store exist ─────────
  const org1 = await prisma.organization.upsert({
    where: { slug: "demo-grocers" },
    update: {},
    create: { name: "Demo Grocers", slug: "demo-grocers" },
  });

  const store1 = await prisma.store.upsert({
    where: { slug: "downtown-mart" },
    update: {},
    create: { organizationId: org1.id, name: "Downtown Mart", slug: "downtown-mart", address: "123 Main Street", status: "ACTIVE" },
  });

  // Create a second store in the same org
  const store2 = await prisma.store.upsert({
    where: { slug: "uptown-mart" },
    update: {},
    create: { organizationId: org1.id, name: "Uptown Mart", slug: "uptown-mart", address: "456 Oak Avenue", status: "ACTIVE" },
  });

  // ── Second org ────────────────────────────────────
  const org2 = await prisma.organization.upsert({
    where: { slug: "fresh-foods" },
    update: {},
    create: { name: "Fresh Foods Co", slug: "fresh-foods" },
  });

  const store3 = await prisma.store.upsert({
    where: { slug: "fresh-central" },
    update: {},
    create: { organizationId: org2.id, name: "Fresh Central", slug: "fresh-central", address: "789 Park Road", status: "ACTIVE" },
  });

  // ── Users ─────────────────────────────────────────

  // ORG_ADMIN for Demo Grocers
  const orgAdmin1 = await prisma.user.upsert({
    where: { email: "orgadmin@demo.dev" },
    update: { passwordHash },
    create: { email: "orgadmin@demo.dev", name: "Org Admin (Demo)", passwordHash, role: "ORG_ADMIN" },
  });
  // Assign to both stores (so they get org context)
  for (const s of [store1, store2]) {
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: orgAdmin1.id, storeId: s.id } },
      update: {},
      create: { userId: orgAdmin1.id, storeId: s.id, role: "ORG_ADMIN" },
    });
  }

  // STORE_MANAGER for Demo Grocers – assigned to store1 only
  const manager1 = await prisma.user.upsert({
    where: { email: "manager@demo.dev" },
    update: { passwordHash },
    create: { email: "manager@demo.dev", name: "Store Manager (Downtown)", passwordHash, role: "STORE_MANAGER" },
  });
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: manager1.id, storeId: store1.id } },
    update: {},
    create: { userId: manager1.id, storeId: store1.id, role: "STORE_MANAGER" },
  });

  // STAFF for Demo Grocers – assigned to store1 only
  const staff1 = await prisma.user.upsert({
    where: { email: "staff@demo.dev" },
    update: { passwordHash },
    create: { email: "staff@demo.dev", name: "Staff (Downtown)", passwordHash, role: "STAFF" },
  });
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: staff1.id, storeId: store1.id } },
    update: {},
    create: { userId: staff1.id, storeId: store1.id, role: "STAFF" },
  });

  // ORG_ADMIN for Fresh Foods (org2)
  const orgAdmin2 = await prisma.user.upsert({
    where: { email: "orgadmin@fresh.dev" },
    update: { passwordHash },
    create: { email: "orgadmin@fresh.dev", name: "Org Admin (Fresh)", passwordHash, role: "ORG_ADMIN" },
  });
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: orgAdmin2.id, storeId: store3.id } },
    update: {},
    create: { userId: orgAdmin2.id, storeId: store3.id, role: "ORG_ADMIN" },
  });

  console.log("=== Test accounts (all passwords: password123) ===\n");
  console.log("SUPER_ADMIN:    admin@martly.dev     (password: admin123)");
  console.log("ORG_ADMIN:      orgadmin@demo.dev    (org: Demo Grocers)");
  console.log("STORE_MANAGER:  manager@demo.dev     (store: Downtown Mart only)");
  console.log("STAFF:          staff@demo.dev       (store: Downtown Mart only)");
  console.log("ORG_ADMIN:      orgadmin@fresh.dev   (org: Fresh Foods Co)");
  console.log("");
  console.log("Orgs:   Demo Grocers, Fresh Foods Co");
  console.log("Stores: Downtown Mart, Uptown Mart (Demo Grocers)");
  console.log("        Fresh Central (Fresh Foods Co)");
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
