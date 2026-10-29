import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { startTripInTx } from "../delivery-trips.js";
import { TripOpError, assignTrips, failDelivery } from "./trip-ops.js";

/** A client whose `updateMany` answers `claimed` rows, and whose $transaction runs its callback on itself */
function fakeDb(claimed: number, ready: { id: string }[] = []) {
  const db = {
    deliveryTrip: {
      updateMany: async () => ({ count: claimed }),
      findMany: async () => [{ id: "t1", storeId: "s1", status: "CREATED", riderId: null }],
    },
    order: {
      updateMany: async () => ({ count: claimed }),
      findMany: async () => ready,
      findFirst: async () => ({ status: "OUT_FOR_DELIVERY" }),
      count: async () => 1,
    },
    orderStatusLog: { create: async () => ({}) },
    deliveryFailure: { create: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return db;
}

test("a trip that was already started or cancelled can't be started again", async () => {
  const tx = fakeDb(0) as unknown as Prisma.TransactionClient;
  await assert.rejects(startTripInTx(tx, "t1", "Ravi"), { statusCode: 409 });
});

test("starting a trip sends out only the orders it moved from READY", async () => {
  const tx = fakeDb(1, [{ id: "o1" }, { id: "o2" }]) as unknown as Prisma.TransactionClient;
  assert.deepEqual(await startTripInTx(tx, "t1", "Ravi"), ["o1", "o2"]);
});

test("a trip that started while being assigned keeps its rider", async () => {
  const db = fakeDb(0) as unknown as PrismaClient;
  await assert.rejects(assignTrips(db, "s1", new Set(["r1"]), [{ tripId: "t1", riderId: "r1" }]), TripOpError);
});

test("a delivery failed twice (or delivered meanwhile) is recorded once", async () => {
  const db = fakeDb(0) as unknown as PrismaClient;
  await assert.rejects(
    failDelivery(db, null, { tripId: "t1", orderId: "o1", riderId: "r1", reason: "CUSTOMER_UNAVAILABLE" }),
    TripOpError,
  );
});
