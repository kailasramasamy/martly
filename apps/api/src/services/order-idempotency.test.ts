import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "../../generated/prisma/index.js";
import { idempotencyKeyOf, isIdempotencyConflict, placedOrderResponse, replayAfterConflict, replayPlacedOrder } from "./order-idempotency.js";

const KEY = "checkout-0123456789abcdef";

const placed = {
  id: "o1",
  userId: "u1",
  totalAmount: new Prisma.Decimal("250.50"),
  walletAmountUsed: new Prisma.Decimal("50.25"),
  loyaltyPointsUsed: 20,
  items: [{ id: "i1", variant: { unitType: "KG" } }],
};

/** A prisma client whose order lookup answers `order` and records the where clause it was asked */
function fakePrisma(order: unknown, asked: unknown[] = []) {
  return {
    order: { findUnique: async (args: { where: unknown }) => { asked.push(args.where); return order; } },
  } as never;
}

function fakeReply() {
  const sent: unknown[] = [];
  const reply = {
    send: (body: unknown) => { sent.push(body); return reply; },
    conflict: (message: string) => { sent.push({ conflict: message }); return reply; },
  };
  return { reply: reply as unknown as FastifyReply, sent };
}

const request = (headers: Record<string, string | string[]>) =>
  ({ headers, user: { sub: "u1" } }) as unknown as FastifyRequest;

const conflict = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6", meta: { target } });

test("a request without the header has no key", () => {
  assert.equal(idempotencyKeyOf(request({})), undefined);
});

test("a well-formed key is read from the header", () => {
  assert.equal(idempotencyKeyOf(request({ "idempotency-key": KEY })), KEY);
});

test("a malformed key is refused with 400", () => {
  for (const bad of ["short", "has spaces in it 1234", "x".repeat(129)]) {
    assert.throws(() => idempotencyKeyOf(request({ "idempotency-key": bad })), { statusCode: 400 });
  }
});

test("only a unique violation on the idempotency key counts as a conflict", () => {
  assert.equal(isIdempotencyConflict(conflict(["user_id", "idempotency_key"])), true);
  assert.equal(isIdempotencyConflict(conflict(["razorpay_order_id"])), false);
  assert.equal(isIdempotencyConflict(new Error("idempotency")), false);
});

test("a repeat answers with what the first request answered, from the stored order", () => {
  const { data } = placedOrderResponse(placed as never);
  assert.equal(data.id, "o1");
  assert.equal(data.walletAmountUsed, 50.25);
  assert.equal(data.loyaltyPointsUsed, 20);
  assert.equal(data.razorpayAmount, 18025);
  assert.equal(data.walletFullyCovered, false);
  assert.equal(data.items[0].variant.unitType, "kg");
});

test("an order paid entirely by wallet and points replays as fully covered", () => {
  const { data } = placedOrderResponse({ ...placed, walletAmountUsed: new Prisma.Decimal("230.50") } as never);
  assert.equal(data.walletFullyCovered, true);
  assert.equal(data.razorpayAmount, 0);
});

test("a key this user already placed an order with returns that order without placing another", async () => {
  const asked: unknown[] = [];
  const { reply, sent } = fakeReply();
  await replayPlacedOrder(fakePrisma(placed, asked))(request({ "idempotency-key": KEY }), reply);
  assert.deepEqual(asked, [{ userId_idempotencyKey: { userId: "u1", idempotencyKey: KEY } }]);
  assert.equal((sent[0] as { data: { id: string } }).data.id, "o1");
});

test("a new key, or no key, goes on to place the order", async () => {
  const { reply, sent } = fakeReply();
  await replayPlacedOrder(fakePrisma(null))(request({ "idempotency-key": KEY }), reply);
  const asked: unknown[] = [];
  await replayPlacedOrder(fakePrisma(placed, asked))(request({}), reply);
  assert.deepEqual(sent, []);
  assert.deepEqual(asked, []);
});

test("losing the race to a request with the same key answers with the winner's order", async () => {
  const { reply, sent } = fakeReply();
  await replayAfterConflict(fakePrisma(placed), request({ "idempotency-key": KEY }), reply);
  assert.equal((sent[0] as { data: { id: string } }).data.id, "o1");
});
