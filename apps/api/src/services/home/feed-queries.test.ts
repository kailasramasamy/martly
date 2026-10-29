import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../../generated/prisma/index.js";
import { pastOrderLines } from "./feed-queries.js";

test("buy-again lines come back newest first, one per product, deduped in the database", async () => {
  const queries: Prisma.Sql[] = [];
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(Prisma.sql(strings, ...values));
      return [{ id: "line-3" }, { id: "line-1" }, { id: "line-2" }];
    },
    orderItem: {
      // The lookup by id answers in its own order
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => [...where.id.in].sort().map((id) => ({ id })),
    },
  } as never;
  const lines = await pastOrderLines(prisma, "store-1", "user-1");
  assert.deepEqual(lines.map((l) => l.id), ["line-3", "line-1", "line-2"]);
  assert.match(queries[0].sql, /DISTINCT ON \(oi\.product_id\)/);
  assert.deepEqual(queries[0].values, ["user-1", "store-1", 10]);
});
