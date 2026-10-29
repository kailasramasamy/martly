import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ALERT_KEY_RETENTION_MS, alertKeyCutoff, pruneAlertKeys } from "./once.js";

const DAY_MS = 24 * 60 * 60 * 1000;

test("alert keys are kept longer than the longest scanner window (a monthly list's month)", () => {
  assert.ok(ALERT_KEY_RETENTION_MS >= 2 * 31 * DAY_MS);
  const now = new Date("2026-10-29T00:00:00Z");
  assert.equal(alertKeyCutoff(now).toISOString(), new Date(now.getTime() - ALERT_KEY_RETENTION_MS).toISOString());
});

test("pruning deletes in batches until a short batch, with the cutoff as UTC wall time", async () => {
  const counts = [5000, 5000, 12];
  const queries: { sql: string; values: unknown[] }[] = [];
  const prisma = {
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ sql: strings.join("?"), values });
      return counts.shift()!;
    },
  } as unknown as PrismaClient;
  const deleted = await pruneAlertKeys(prisma, new Date("2026-10-29T00:00:00Z"));
  assert.equal(deleted, 10_012);
  assert.equal(queries.length, 3);
  assert.match(queries[0].sql, /DELETE FROM alert_once/);
  const cutoff = queries[0].values[0] as { values: unknown[] };
  assert.equal(cutoff.values[0], alertKeyCutoff(new Date("2026-10-29T00:00:00Z")).toISOString());
});
