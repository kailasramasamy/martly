import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { canWatchOrder, canWatchTrip } from "./ws-access.js";

const STORE = "store-a";
const ORG = "org-a";
const orders = [
  { id: "order-1", userId: "shopper-1", storeId: STORE, deliveryTripId: "trip-1" },
];
const trips = [{ id: "trip-1", riderId: "rider-1", storeId: STORE }];
const stores = [{ id: STORE, organizationId: ORG }];
const userStores = [{ userId: "manager-a", storeId: STORE }, { userId: "rider-1", storeId: STORE }];

/** Just the queries ws-access and the org-scope helpers make */
const prisma = {
  order: {
    findUnique: async ({ where }: { where: { id: string } }) => orders.find((o) => o.id === where.id) ?? null,
    count: async ({ where }: { where: { deliveryTripId: string; userId: string } }) =>
      orders.filter((o) => o.deliveryTripId === where.deliveryTripId && o.userId === where.userId).length,
  },
  deliveryTrip: { findUnique: async ({ where }: { where: { id: string } }) => trips.find((t) => t.id === where.id) ?? null },
  store: {
    findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
      stores.find((s) => s.id === where.id && s.organizationId === where.organizationId) ?? null,
  },
  userStore: {
    findFirst: async ({ where }: { where: { userId: string; storeId: string; store: { organizationId: string } } }) =>
      userStores.find((u) => u.userId === where.userId && u.storeId === where.storeId && where.store.organizationId === ORG) ?? null,
  },
} as unknown as PrismaClient;

const as = (sub: string, role: string, organizationId?: string) => ({ user: { sub, email: "", role, organizationId } }) as unknown as FastifyRequest;

test("an order's own customer may watch it; another customer may not", async () => {
  assert.equal(await canWatchOrder(as("shopper-1", "CUSTOMER"), prisma, "order-1"), true);
  assert.equal(await canWatchOrder(as("shopper-2", "CUSTOMER"), prisma, "order-1"), false);
});

test("staff may watch orders of stores they can see, and only those", async () => {
  assert.equal(await canWatchOrder(as("owner-a", "ORG_ADMIN", ORG), prisma, "order-1"), true);
  assert.equal(await canWatchOrder(as("owner-b", "ORG_ADMIN", "org-b"), prisma, "order-1"), false);
  assert.equal(await canWatchOrder(as("manager-a", "STORE_MANAGER", ORG), prisma, "order-1"), true);
  assert.equal(await canWatchOrder(as("staff-x", "STAFF", ORG), prisma, "order-1"), false);
  assert.equal(await canWatchOrder(as("admin", "SUPER_ADMIN"), prisma, "order-1"), true);
  assert.equal(await canWatchOrder(as("brand", "BRAND_PARTNER"), prisma, "order-1"), false);
});

test("an unknown order can't be watched", async () => {
  assert.equal(await canWatchOrder(as("admin", "SUPER_ADMIN"), prisma, "missing"), false);
});

test("a trip's rider, its customers and its store's staff may watch it; nobody else", async () => {
  assert.equal(await canWatchTrip(as("rider-1", "RIDER", ORG), prisma, "trip-1"), true);
  assert.equal(await canWatchTrip(as("shopper-1", "CUSTOMER"), prisma, "trip-1"), true);
  assert.equal(await canWatchTrip(as("manager-a", "STORE_MANAGER", ORG), prisma, "trip-1"), true);
  assert.equal(await canWatchTrip(as("shopper-2", "CUSTOMER"), prisma, "trip-1"), false);
  assert.equal(await canWatchTrip(as("rider-2", "RIDER", ORG), prisma, "trip-1"), false);
  assert.equal(await canWatchTrip(as("owner-b", "ORG_ADMIN", "org-b"), prisma, "trip-1"), false);
  assert.equal(await canWatchTrip(as("admin", "SUPER_ADMIN"), prisma, "missing"), false);
});
