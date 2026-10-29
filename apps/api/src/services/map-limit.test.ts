import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLimit } from "./map-limit.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("runs at most `limit` at a time and keeps the order", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
    peak = Math.max(peak, ++running);
    for (let i = 0; i < n; i++) await tick();
    running--;
    return n * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
  assert.equal(peak, 2);
});

test("an empty list resolves to an empty list", async () => {
  assert.deepEqual(await mapLimit([], 3, async (n: number) => n), []);
});

test("a failure rejects the whole map", async () => {
  await assert.rejects(mapLimit([1, 2], 2, async (n) => {
    if (n === 2) throw new Error("boom");
    return n;
  }), /boom/);
});
