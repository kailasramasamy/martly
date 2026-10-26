/**
 * Seeds staff accounts for testing the mobile Manage persona against the Martly Template org.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-users.ts
 *   --no-qa skips the Martly QA org/store and multi@martly.dev (for production demos)
 *
 * demo@martly.in        / owner123     ORG_ADMIN      all Martly Template stores
 * owner@martly.in       / owner123     ORG_ADMIN      all Martly Template stores (same owner role)
 * manager@martly.in     / manager123   STORE_MANAGER  Template Store
 * staff@martly.in       / staff123     STAFF          Template Store + online orders add-ons
 * catalog@martly.in     / catalog123   STAFF          Template Store + catalog editor add-ons
 * counter@martly.in     / counter123   STAFF          Template Store + stock count add-on
 * plain@martly.in       / plain123     STAFF          Template Store, no add-ons
 * rider@martly.in       / rider123     RIDER          Template Store
 * multi@martly.dev      / multi123     STORE_MANAGER  Template Store + Martly QA store (org picker)
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
  const harur = await prisma.store.findFirst({ where: { name: "Template Store" }, select: { id: true, organizationId: true } });
  if (!harur) throw new Error("Template Store not found — sync or seed the base catalog first");

  const orgStores = await prisma.store.findMany({ where: { organizationId: harur.organizationId }, select: { id: true } });
  const withQa = !process.argv.includes("--no-qa");

  await upsertStaff("demo@martly.in", "owner123", "Demo Owner", "ORG_ADMIN", orgStores.map((s) => s.id));
  await upsertStaff("owner@martly.in", "owner123", "Martly Owner", "ORG_ADMIN", orgStores.map((s) => s.id));
  await upsertStaff("manager@martly.in", "manager123", "Martly Manager", "STORE_MANAGER", [harur.id]);
  await upsertStaff("staff@martly.in", "staff123", "Martly Staff", "STAFF", [harur.id],
    ["ORDERS_VIEW", "ORDERS_PROCESS", "ORDERS_DISPATCH", "DELIVERY_DELIVER"]);
  await upsertStaff("catalog@martly.in", "catalog123", "Martly Catalog Editor", "STAFF", [harur.id],
    ["CATALOG_PRODUCTS", "CATALOG_BRANDS"]);
  await upsertStaff("counter@martly.in", "counter123", "Martly Stock Counter", "STAFF", [harur.id], ["STOCK_COUNT"]);
  await upsertStaff("plain@martly.in", "plain123", "Martly Floor Staff", "STAFF", [harur.id]);
  await upsertStaff("rider@martly.in", "rider123", "Martly Rider", "RIDER", [harur.id]);
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
