import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { issueOtp, verifyOtp } from "./otp.js";

const PHONE = "9876543210";
const CODE = "123456";
process.env.OTP_FIXED_LOGINS = `${PHONE}:${CODE}`;

interface Row { id: string; phone: string; codeHash: string; attempts: number; expiresAt: Date; updatedAt: Date }
type Where = Partial<{ id: string; phone: string; codeHash: string; attempts: { lt?: number; gte?: number }; expiresAt: { gt: Date } }>;

/** An in-memory otp_codes table whose every call yields first, so parallel requests interleave like real queries */
function fakePrisma() {
  let row: Row | null = null;
  let claims = 0;
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const matches = (where: Where) => row !== null
    && (where.id === undefined || row.id === where.id)
    && (where.phone === undefined || row.phone === where.phone)
    && (where.codeHash === undefined || row.codeHash === where.codeHash)
    && (where.attempts?.lt === undefined || row.attempts < where.attempts.lt)
    && (where.attempts?.gte === undefined || row.attempts >= where.attempts.gte)
    && (where.expiresAt === undefined || row.expiresAt > where.expiresAt.gt);
  const otpCode = {
    async findUnique() { await tick(); return row && { ...row }; },
    async upsert({ create }: { create: Omit<Row, "id" | "updatedAt"> }) { await tick(); row = { id: "otp-1", ...create, updatedAt: new Date(0) }; },
    async updateMany({ where }: { where: Where }) {
      await tick();
      if (!matches(where)) return { count: 0 };
      row!.attempts++;
      claims++;
      return { count: 1 };
    },
    async deleteMany({ where }: { where: Where }) {
      await tick();
      if (!matches(where)) return { count: 0 };
      row = null;
      return { count: 1 };
    },
  };
  return { prisma: { otpCode } as unknown as FastifyInstance["prisma"], claims: () => claims };
}

const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
let db: ReturnType<typeof fakePrisma>;

beforeEach(async () => {
  db = fakePrisma();
  await issueOtp(db.prisma, PHONE, log);
});

const settle = (guesses: string[]) => Promise.allSettled(guesses.map((g) => verifyOtp(db.prisma, PHONE, g)));

test("parallel wrong guesses can't exceed the five-attempt cap", async () => {
  const results = await settle(Array.from({ length: 50 }, (_, i) => String(100000 + i)));
  assert.equal(db.claims(), 5, "only five guesses were ever compared");
  assert.equal(results.filter((r) => r.status === "fulfilled").length <= 5, true);
  await assert.rejects(verifyOtp(db.prisma, PHONE, CODE), /expired or already used/);
});

test("the right code is refused once the attempts are used up", async () => {
  await settle(["000001", "000002", "000003", "000004", "000005"]);
  await assert.rejects(verifyOtp(db.prisma, PHONE, CODE), /expired or already used/);
});

test("a correct code signs in once, even when sent twice at the same time", async () => {
  const results = await settle([CODE, CODE]);
  const values = results.map((r) => (r.status === "fulfilled" ? r.value : "rejected"));
  assert.equal(values.filter((v) => v === true).length, 1);
});

test("a wrong guess counts an attempt and the code still works afterwards", async () => {
  assert.equal(await verifyOtp(db.prisma, PHONE, "000000"), false);
  assert.equal(await verifyOtp(db.prisma, PHONE, CODE), true);
});
