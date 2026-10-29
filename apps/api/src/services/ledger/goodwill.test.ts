import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "../../../generated/prisma/client.js";
import { supportCreditLeft } from "./goodwill.js";

function fakeTx(sums: { type: string; amount: number }[], seen: unknown[] = []) {
  return {
    walletTransaction: {
      groupBy: async (args: unknown) => {
        seen.push(args);
        return sums.map((s) => ({ type: s.type, _sum: { amount: s.amount } }));
      },
    },
  } as unknown as Prisma.TransactionClient;
}

test("org staff may take back only the support credit their organization gave", async () => {
  const seen: { where: unknown }[] = [];
  const left = await supportCreditLeft(fakeTx([{ type: "CREDIT", amount: 300 }, { type: "DEBIT", amount: 100 }], seen), "u1", "orgA");
  assert.equal(left, 200);
  assert.deepEqual(seen[0].where, { userId: "u1", organizationId: "orgA", reason: "SUPPORT" });
});

test("a customer the organization never credited has nothing to take back", async () => {
  assert.equal(await supportCreditLeft(fakeTx([]), "u1", "orgA"), 0);
});
