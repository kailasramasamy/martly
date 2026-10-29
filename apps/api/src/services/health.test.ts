import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReadiness } from "./health.js";

test("ready when the database answers", async () => {
  const result = await checkReadiness(async () => [{ "?column?": 1 }]);
  assert.deepEqual(result, { statusCode: 200, body: { status: "ok", db: "ok" } });
});

test("503 when the database query fails", async () => {
  const result = await checkReadiness(async () => {
    throw new Error("Can't reach database server");
  });
  assert.deepEqual(result, { statusCode: 503, body: { status: "unavailable", db: "down" } });
});

test("503 when the database doesn't answer within the timeout", async () => {
  const started = Date.now();
  const result = await checkReadiness(() => new Promise(() => {}), 50);
  assert.deepEqual(result, { statusCode: 503, body: { status: "unavailable", db: "timeout" } });
  assert.ok(Date.now() - started < 1000);
});
