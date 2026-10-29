import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { paymentMismatch, type RazorpayPayment } from "./payment.js";
import { settleAttemptPayment, verifyOrderPayment } from "./order-payment.js";
import { settleMembershipPurchase } from "./membership-purchase.js";
import { markPaymentFailed } from "./notify/order-alerts.js";

const captured = (orderId: string, amount: number): RazorpayPayment => ({ id: "pay_1", orderId, amount, status: "captured" });

/** An app whose Prisma only answers the lookups these payment paths make before settling anything */
function fakeApp(rows: { attempt?: object; purchase?: object; order?: object }, calls: unknown[] = []) {
  const prisma = {
    paymentAttempt: { findUnique: async () => rows.attempt ?? null },
    membershipPurchase: { findUnique: async () => rows.purchase ?? null },
    order: { findFirst: async () => rows.order ?? null, updateMany: async (args: unknown) => { calls.push(args); return { count: 0 }; } },
    $transaction: async () => { throw new Error("must not settle"); },
  };
  return { prisma, log: { error: () => {} } } as unknown as FastifyInstance;
}

test("a payment on another Razorpay order is a mismatch", () => {
  assert.equal(paymentMismatch(captured("order_cheap", 100), { razorpayOrderId: "order_big", amountInPaise: 500000 }), "Payment does not belong to this order");
});

test("an authorised but uncaptured payment does not settle", () => {
  const payment = { ...captured("order_a", 500000), status: "authorized" };
  assert.equal(paymentMismatch(payment, { razorpayOrderId: "order_a", amountInPaise: 500000 }), "Payment is not complete yet");
});

test("a payment short of the attempt's amount does not settle", () => {
  assert.equal(paymentMismatch(captured("order_a", 100), { razorpayOrderId: "order_a", amountInPaise: 500000 }), "Payment amount does not match");
  assert.equal(paymentMismatch(captured("order_a", 500000), { razorpayOrderId: "order_a", amountInPaise: 500000 }), null);
});

test("a ₹1 payment can't settle a ₹5,000 order's attempt", async () => {
  const app = fakeApp({ attempt: { orderId: "big", razorpayOrderId: "order_a", amount: 500000 } });
  assert.deepEqual(await settleAttemptPayment(app, captured("order_a", 100)), { mismatch: "Payment amount does not match" });
});

test("an order prepared before attempts existed is still held to what it owes", async () => {
  const money = (n: number) => ({ toNumber: () => n });
  const order = { id: "big", totalAmount: money(5000), walletAmountUsed: money(0), loyaltyPointsUsed: 0 };
  const app = fakeApp({ order });
  assert.deepEqual(await settleAttemptPayment(app, captured("order_old", 100)), { mismatch: "Payment amount does not match" });
});

test("an attempt that belongs to another order is ignored", async () => {
  const app = fakeApp({ attempt: { orderId: "cheap", razorpayOrderId: "order_a", amount: 100 } });
  assert.equal(await settleAttemptPayment(app, captured("order_a", 100), "big"), null);
});

test("verify refuses a Razorpay order raised for a different order, before trusting its signature", async () => {
  const app = fakeApp({ attempt: { orderId: "cheap", razorpayOrderId: "order_cheap", amount: 100 } });
  const body = { razorpay_order_id: "order_cheap", razorpay_payment_id: "pay_1", razorpay_signature: "valid-for-cheap" };
  await assert.rejects(verifyOrderPayment(app, "big", body), { statusCode: 400, message: "Payment does not belong to this order" });
});

test("a ₹1 payment can't buy a ₹999 membership", async () => {
  const purchase = { id: "p1", userId: "u1", razorpayOrderId: "order_m", amount: 999, plan: { name: "Gold", duration: "ANNUAL" } };
  const app = fakeApp({ purchase });
  assert.deepEqual(await settleMembershipPurchase(app, captured("order_m", 100), "u1"), { mismatch: "Payment amount does not match" });
});

test("another user's membership purchase is not theirs to settle", async () => {
  const purchase = { id: "p1", userId: "owner", razorpayOrderId: "order_m", amount: 999, plan: { name: "Gold", duration: "ANNUAL" } };
  assert.equal(await settleMembershipPurchase(fakeApp({ purchase }), captured("order_m", 99900), "someone-else"), null);
});

test("a failed payment only flags an open, unpaid order", async () => {
  const calls: { where: { status: unknown; paymentStatus: unknown } }[] = [];
  await markPaymentFailed(fakeApp({}, calls), "o1", "pay_1");
  assert.deepEqual(calls[0].where.paymentStatus, { in: ["PENDING", "FAILED"] });
  assert.deepEqual(calls[0].where.status, { not: "CANCELLED" });
});
