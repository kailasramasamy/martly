/**
 * Seeds staff accounts for testing the mobile Manage persona against the Demo Grocers org.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-users.ts
 *   --no-qa skips the Martly QA org/store and multi@martly.dev (for production demos)
 *
 * owner@demogrocers.dev / owner123     ORG_ADMIN      all Demo Grocers stores
 * owner@harur.dev       / owner123     ORG_ADMIN      all Demo Grocers stores (same owner role, Harur-style login)
 * manager@harur.dev     / manager123   STORE_MANAGER  Harur Fresh Mart
 * staff@harur.dev       / staff123     STAFF          Harur Fresh Mart + online orders add-ons
 * catalog@harur.dev     / catalog123   STAFF          Harur Fresh Mart + catalog editor add-ons
 * counter@harur.dev     / counter123   STAFF          Harur Fresh Mart + stock count add-on
 * plain@harur.dev       / plain123     STAFF          Harur Fresh Mart, no add-ons
 * rider@harur.dev       / rider123     RIDER          Harur Fresh Mart
 * multi@martly.dev      / multi123     STORE_MANAGER  Harur Fresh Mart + Martly QA store (org picker)
 */
import { PrismaClient, type Permission, type UserRole } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertStaff(
  email: string, password: string, name: string, role: UserRole, storeIds: string[], addOns: Permission[] = [],
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role, name, passwordHash },
    create: { email, name, role, passwordHash },
  });
  for (const storeId of storeIds) {
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: user.id, storeId } },
      update: {},
      create: { userId: user.id, storeId },
    });
  }
  const orgs = await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { organizationId: true }, distinct: ["organizationId"] });
  for (const { organizationId } of orgs) {
    await prisma.memberPermission.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      update: { permissions: addOns },
      create: { userId: user.id, organizationId, permissions: addOns },
    });
  }
  console.log(`${role.padEnd(14)} ${email} → ${storeIds.length} store(s)${addOns.length ? ` + ${addOns.join(", ")}` : ""}`);
}

async function ensureQaStore() {
  const org = await prisma.organization.upsert({
    where: { slug: "martly-qa" },
    update: {},
    create: { name: "Martly QA", slug: "martly-qa" },
  });
  return prisma.store.upsert({
    where: { slug: "martly-qa-store" },
    update: {},
    // PENDING keeps it out of customer store discovery
    create: { organizationId: org.id, name: "QA Test Store", slug: "martly-qa-store", address: "Harur, Dharmapuri", status: "PENDING" },
  });
}

async function main() {
  const harur = await prisma.store.findFirst({ where: { name: "Harur Fresh Mart" }, select: { id: true, organizationId: true } });
  if (!harur) throw new Error("Harur Fresh Mart not found — sync or seed the base catalog first");

  const orgStores = await prisma.store.findMany({ where: { organizationId: harur.organizationId }, select: { id: true } });
  const withQa = !process.argv.includes("--no-qa");

  await upsertStaff("owner@demogrocers.dev", "owner123", "Demo Owner", "ORG_ADMIN", orgStores.map((s) => s.id));
  await upsertStaff("owner@harur.dev", "owner123", "Harur Owner", "ORG_ADMIN", orgStores.map((s) => s.id));
  await upsertStaff("manager@harur.dev", "manager123", "Harur Manager", "STORE_MANAGER", [harur.id]);
  await upsertStaff("staff@harur.dev", "staff123", "Harur Staff", "STAFF", [harur.id],
    ["ORDERS_VIEW", "ORDERS_PROCESS", "ORDERS_DISPATCH", "DELIVERY_DELIVER"]);
  await upsertStaff("catalog@harur.dev", "catalog123", "Harur Catalog Editor", "STAFF", [harur.id],
    ["CATALOG_PRODUCTS", "CATALOG_BRANDS"]);
  await upsertStaff("counter@harur.dev", "counter123", "Harur Stock Counter", "STAFF", [harur.id], ["STOCK_COUNT"]);
  await upsertStaff("plain@harur.dev", "plain123", "Harur Floor Staff", "STAFF", [harur.id]);
  await upsertStaff("rider@harur.dev", "rider123", "Harur Rider", "RIDER", [harur.id]);
  if (withQa) {
    const qaStore = await ensureQaStore();
    await upsertStaff("multi@martly.dev", "multi123", "Multi-org Manager", "STORE_MANAGER", [harur.id, qaStore.id]);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
