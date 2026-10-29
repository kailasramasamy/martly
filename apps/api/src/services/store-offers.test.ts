import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../generated/prisma/index.js";
import { listStoreOffers } from "./store-offers.js";

const listing = (id: string, name: string) => ({
  id, price: new Prisma.Decimal(100), memberPrice: new Prisma.Decimal(90), offerBuyQty: 1, offerGetQty: 1,
  offerStart: null, offerEnd: null, discountType: "PERCENTAGE", discountValue: new Prisma.Decimal(10),
  discountStart: null, discountEnd: null, product: { name, imageUrl: null }, variant: { name: "1 kg" },
});

/** The page query answers `page`; the listing lookup answers in its own order, as the database may */
function fakePrisma(page: { id: string; kind: string; total: number }[], count = 0) {
  const pageQueries: Prisma.Sql[] = [];
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Prisma.sql(strings, ...values);
      if (sql.sql.includes("LIMIT")) return (pageQueries.push(sql), page);
      return [{ total: count }];
    },
    storeProduct: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        [...where.id.in].reverse().map((id) => listing(id, `Product ${id}`)),
    },
  } as never;
  return { prisma, pageQueries };
}

test("a page comes back in the database's order, with the total from the same query", async () => {
  const { prisma, pageQueries } = fakePrisma([
    { id: "sp2", kind: "DISCOUNT", total: 7 },
    { id: "sp1", kind: "BUY_GET", total: 7 },
  ]);
  const out = await listStoreOffers(prisma, { storeId: "s1", status: "live", page: 3, pageSize: 2 });
  assert.deepEqual(out.items.map((o) => o.id), ["DISCOUNT:sp2", "BUY_GET:sp1"]);
  assert.equal(out.items[0].discountValue, 10);
  assert.equal(out.items[1].buy, 1);
  assert.equal(out.total, 7);
  // LIMIT pageSize OFFSET (page - 1) * pageSize
  assert.deepEqual(pageQueries[0].values.slice(-2), [2, 4]);
});

test("a page past the last offer is empty and still reports the total", async () => {
  const { prisma } = fakePrisma([], 5);
  const out = await listStoreOffers(prisma, { storeId: "s1", status: "ended", page: 9, pageSize: 20 });
  assert.deepEqual(out, { items: [], total: 5 });
});
