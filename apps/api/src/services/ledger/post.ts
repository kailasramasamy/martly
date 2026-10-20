import type { Prisma } from "../../../generated/prisma/client.js";
import type { LedgerEntryType, LedgerSourceType } from "../../../generated/prisma/index.js";

type Tx = Prisma.TransactionClient;

export interface EntryInput {
  organizationId: string;
  storeId?: string | null;
  type: LedgerEntryType;
  /** Positive when Martly owes the store */
  amount: number;
  sourceType: LedgerSourceType;
  sourceId: string;
  orderId?: string | null;
  /** Defaults to now: refunds and fees are settleable straight away */
  availableAt?: Date;
  settlementId?: string;
  memo: string;
  createdBy?: string | null;
}

export const money = (n: number) => Math.round(n * 100) / 100;

/**
 * The single writer to the ledger. Runs inside the caller's transaction so an entry exists exactly when its money
 * moved; each (type, source) posts once, so a retry or a racing duplicate is ignored rather than failing.
 */
export async function postEntries(tx: Tx, entries: EntryInput[]): Promise<number> {
  const now = new Date();
  const data = entries
    .filter((e) => money(e.amount) !== 0)
    .map((e) => ({ ...e, amount: money(e.amount), availableAt: e.availableAt ?? now }));
  if (data.length === 0) return 0;
  const { count } = await tx.ledgerEntry.createMany({ data, skipDuplicates: true });
  return count;
}

/** Serialises balance-changing work for one organization (payouts, paying from the balance) */
export async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`;
}
