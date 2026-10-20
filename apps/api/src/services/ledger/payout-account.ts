import crypto from "crypto";
import type { PayoutAccountInput } from "@martly/shared/schemas";
import type { OrgPayoutAccount, PrismaClient } from "../../../generated/prisma/client.js";

function key(): Buffer {
  const hex = process.env.PAYOUT_ACCOUNT_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw Object.assign(new Error("Payout accounts are not configured"), { statusCode: 503 });
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM, stored as iv.tag.ciphertext in base64 */
function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptAccountNumber(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** What any screen may show: never the full account number */
export function publicPayoutAccount(a: OrgPayoutAccount | null) {
  if (!a) return null;
  return {
    accountHolder: a.accountHolder, accountLast4: a.accountLast4, ifsc: a.ifsc, upiVpa: a.upiVpa,
    verified: !!a.verifiedAt, verifiedAt: a.verifiedAt, updatedAt: a.updatedAt,
  };
}

/**
 * Saving always clears verification, so payouts pause until Martly checks the details. A blank account number keeps
 * the stored one, since screens only ever see its last 4 digits.
 */
export async function savePayoutAccount(prisma: PrismaClient, organizationId: string, input: PayoutAccountInput, userId: string) {
  const existing = await prisma.orgPayoutAccount.findUnique({ where: { organizationId } });
  const bank = input.accountNumber
    ? { accountNumberEnc: encrypt(input.accountNumber), accountLast4: input.accountNumber.slice(-4), ifsc: input.ifsc ?? null }
    : { accountNumberEnc: existing?.accountNumberEnc ?? null, accountLast4: existing?.accountLast4 ?? null, ifsc: existing?.accountNumberEnc ? input.ifsc ?? existing.ifsc : null };
  if (!(bank.accountNumberEnc && bank.ifsc) && !input.upiVpa) {
    throw Object.assign(new Error("Add a bank account with IFSC, or a UPI ID"), { statusCode: 400 });
  }
  const data = { accountHolder: input.accountHolder, ...bank, upiVpa: input.upiVpa ?? null, verifiedAt: null, verifiedBy: null, updatedBy: userId };
  return prisma.orgPayoutAccount.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
}

/** Martly confirms the details; draft settlements for the organization are then scheduled */
export async function verifyPayoutAccount(prisma: PrismaClient, organizationId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.orgPayoutAccount.update({ where: { organizationId }, data: { verifiedAt: new Date(), verifiedBy: userId } });
    await tx.settlement.updateMany({ where: { organizationId, status: "DRAFT", carriedIntoId: null }, data: { status: "APPROVED" } });
    return account;
  });
}
