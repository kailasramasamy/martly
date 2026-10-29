import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../generated/prisma/index.js";
import { lifetimeSales, recentSales, salesTable } from "./product-sales.js";

function fakePrisma() {
  const queries: Prisma.Sql[] = [];
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(Prisma.sql(strings, ...values));
      return [{ product_id: "p1", n: 3 }, { product_id: "p2", n: 1 }];
    },
  } as never;
  return { prisma, queries };
}

test("a store's counts are read once and shared until they expire", async () => {
  const { prisma, queries } = fakePrisma();
  const first = await lifetimeSales(prisma, "store-a");
  const again = await lifetimeSales(prisma, "store-a");
  assert.deepEqual(first, { productIds: ["p1", "p2"], counts: [3, 1] });
  assert.equal(again, first);
  assert.equal(queries.length, 1);
  await lifetimeSales(prisma, "store-b");
  assert.equal(queries.length, 2);
});

test("lifetime counts skip cancelled orders; recent counts are a separate window of every status", async () => {
  const { prisma, queries } = fakePrisma();
  await lifetimeSales(prisma, undefined);
  await recentSales(prisma, "store-c", 90);
  assert.match(queries[0].sql, /status <> 'CANCELLED'/);
  assert.doesNotMatch(queries[1].sql, /CANCELLED/);
  assert.match(queries[1].sql, /created_at >=/);
});

test("the counts join as a (product_id, n) table", () => {
  const sql = salesTable({ productIds: ["p1"], counts: [2] });
  assert.equal(sql.sql, "(SELECT * FROM unnest(?::text[], ?::int[]) AS s(product_id, n))");
  assert.deepEqual(sql.values, [["p1"], [2]]);
});
