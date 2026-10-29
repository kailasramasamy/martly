import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { claimSlotPlace, claimStatus, lockCoupon, releaseCoupon, toPaise } from "./order-guards.js";
import { cancelOrder } from "./order-cancel.js";

type Call = [string, unknown];

/** A transaction client that records what it is asked and answers `updateMany` with `claimed` rows */
function fakeTx(calls: Call[], claimed: number, extra: Record<string, unknown> = {}) {
  const record = (name: string, result: unknown) => async (args: unknown) => { calls.push([name, args]); return result; };
  return {
    order: { updateMany: record("order.updateMany", { count: claimed }) },
    couponRedemption: { deleteMany: record("couponRedemption.deleteMany", { count: 1 }) },
    coupon: { update: record("coupon.update", {}) },
    $executeRaw: record("$executeRaw", 1),
    user: { update: record("user.update", { walletBalance: 0 }) },
    ...extra,
  } as unknown as Prisma.TransactionClient;
}

const open = { status: "CONFIRMED", paymentStatus: "PAID" } as const;

test("claiming a status matches the status and payment status it was read in", async () => {
  const calls: Call[] = [];
  await claimStatus(fakeTx(calls, 1), "o1", open, "CANCELLED");
  assert.deepEqual(calls[0], ["order.updateMany", { where: { id: "o1", ...open }, data: { status: "CANCELLED" } }]);
});

test("a second cancel or delivery of the same order is refused with 409", async () => {
  await assert.rejects(claimStatus(fakeTx([], 0), "o1", open, "CANCELLED"), { statusCode: 409 });
});

test("cancelling gives the coupon use back", async () => {
  const calls: Call[] = [];
  await releaseCoupon(fakeTx(calls, 1), { id: "o1", couponId: "c1" });
  assert.deepEqual(calls.map((c) => c[0]), ["couponRedemption.deleteMany", "coupon.update"]);
  assert.deepEqual(calls[1][1], { where: { id: "c1" }, data: { usedCount: { decrement: 1 } } });
});

test("a coupon at its limit is refused when re-checked under the lock", async () => {
  const coupon = { id: "c1", isActive: true, usageLimit: 100, usedCount: 100, perUserLimit: 1, organizationId: null, minOrderAmount: null };
  const tx = fakeTx([], 1, {
    $queryRaw: async () => [{ id: "c1" }],
    coupon: { findUniqueOrThrow: async () => coupon },
    couponRedemption: { count: async () => 0 },
  });
  const check = await lockCoupon(tx, "c1", { userId: "u1", organizationId: "org", orderAmount: 500 });
  assert.deepEqual(check, { ok: false, reason: "This coupon has reached its usage limit" });
});

function fakeApp(order: Record<string, unknown>, calls: Call[], claimed: number) {
  const prisma = {
    order: { findUniqueOrThrow: async () => order },
    $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(fakeTx(calls, claimed)),
  };
  return { prisma } as unknown as FastifyInstance;
}

const unpaid = { id: "o1", userId: "u1", storeId: "s1", status: "PENDING", paymentStatus: "PENDING", items: [{ storeProductId: "sp1", quantity: 2 }] };
const expiry = { by: "system" as const, note: "expired", allowed: { statuses: ["PENDING" as const], paymentStatuses: ["PENDING" as const, "FAILED" as const] } };

test("the unpaid-expiry job leaves an order that got paid in the meantime", async () => {
  const calls: Call[] = [];
  assert.equal(await cancelOrder(fakeApp({ ...unpaid, paymentStatus: "PAID" }, calls, 1), "o1", expiry), null);
  assert.equal(calls.length, 0);
});

test("a cancel that loses the race releases no stock and refunds nothing", async () => {
  const calls: Call[] = [];
  await assert.rejects(cancelOrder(fakeApp(unpaid, calls, 0), "o1", expiry), { statusCode: 409 });
  assert.deepEqual(calls.map((c) => c[0]), ["order.updateMany"]);
});

test("a wallet that covers the total leaves exactly nothing to pay, whatever the float sum of the prices", async () => {
  const total = toPaise(0.1 + 0.2 + 49.7);
  assert.equal(toPaise(total - Math.min(50, total)), 0);
});

test("a full delivery slot refuses the booking while holding the slot's lock", async () => {
  const calls: Call[] = [];
  const tx = fakeTx(calls, 0, {
    $queryRaw: async () => { calls.push(["lock", null]); return []; },
    order: { count: async () => 20 },
  });
  await assert.rejects(claimSlotPlace(tx, "slot1", { start: new Date(), end: new Date() }, 20), { statusCode: 400 });
  assert.equal(calls[0][0], "lock");
});
