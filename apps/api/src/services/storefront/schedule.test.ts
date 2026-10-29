import { test } from "node:test";
import assert from "node:assert/strict";
import { SNAPSHOT_REFRESH_MS, refreshDueSnapshots, storesDue } from "./schedule.js";

const now = new Date("2026-10-29T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("a store is due without today's snapshot or once it's six hours old", () => {
  const due = storesDue(["fresh", "stale", "missing", "edge"], [
    { storeId: "fresh", updatedAt: ago(SNAPSHOT_REFRESH_MS - 1) },
    { storeId: "stale", updatedAt: ago(SNAPSHOT_REFRESH_MS + 60_000) },
    { storeId: "edge", updatedAt: ago(SNAPSHOT_REFRESH_MS) },
  ], now);
  assert.deepEqual(due, ["stale", "missing", "edge"]);
});

test("the check reads today's IST snapshots, so a restart keeps the schedule", async () => {
  const asked: unknown[] = [];
  const prisma = {
    store: { findMany: async () => [{ id: "a" }, { id: "b" }] },
    storefrontHealthSnapshot: {
      findMany: async (args: { where: unknown }) => {
        asked.push(args.where);
        return [{ storeId: "a", updatedAt: ago(60_000) }, { storeId: "b", updatedAt: ago(60_000) }];
      },
    },
  } as never;
  // Both were scored a minute ago (say, just before a restart): nothing to do
  assert.equal(await refreshDueSnapshots(prisma, now), 0);
  // 17:30 IST on the 29th is still the 29th's snapshot
  assert.deepEqual(asked, [{ date: new Date("2026-10-29T00:00:00Z") }]);
});
