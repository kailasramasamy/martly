import { BALANCE_DUE_THRESHOLD, BALANCE_DUE_WEEKS, SETTLEMENT_MIN_PAYOUT } from "@martly/shared/constants";
import type { MarkSettlementsPaidInput } from "@martly/shared/schemas";
import type { Prisma, PrismaClient, Settlement } from "../../../generated/prisma/client.js";
import { OPEN_SETTLEMENT_STATUSES, istWeekStart } from "./balance.js";
import { lockOrganization, money, postEntries } from "./post.js";

type Tx = Prisma.TransactionClient;

const httpError = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/** STL/2026-27/0001, numbered per Indian financial year */
async function nextSettlementNumber(tx: Tx, at: Date) {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  const startYear = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const fy = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  const { last } = await tx.settlementCounter.upsert({ where: { fy }, create: { fy, last: 1 }, update: { last: { increment: 1 } } });
  return `STL/${fy}/${String(last).padStart(4, "0")}`;
}

/**
 * Sweeps every available, unsettled entry plus earlier unpaid nets into one settlement. A positive net at or above
 * the minimum is scheduled for payout (or waits for verified bank details); anything else carries forward.
 */
export async function settleOrganization(tx: Tx, organizationId: string, now: Date): Promise<Settlement | null> {
  await lockOrganization(tx, organizationId);
  const [entries, open, previous, account] = await Promise.all([
    tx.ledgerEntry.findMany({ where: { organizationId, settlementId: null, availableAt: { lte: now } }, select: { id: true, amount: true, createdAt: true } }),
    tx.settlement.findMany({ where: { organizationId, status: { in: [...OPEN_SETTLEMENT_STATUSES] }, carriedIntoId: null } }),
    tx.settlement.findFirst({ where: { organizationId }, orderBy: { periodEnd: "desc" }, select: { periodEnd: true } }),
    tx.orgPayoutAccount.findUnique({ where: { organizationId }, select: { verifiedAt: true } }),
  ]);
  if (entries.length === 0 && open.length === 0) return null;

  const amounts = entries.map((e) => Number(e.amount));
  const credits = money(amounts.filter((a) => a > 0).reduce((n, a) => n + a, 0));
  const debits = money(amounts.filter((a) => a < 0).reduce((n, a) => n + a, 0));
  const carriedIn = money(open.reduce((n, s) => n + Number(s.net), 0));
  const net = money(credits + debits + carriedIn);
  const earliest = entries.reduce<Date>((d, e) => (e.createdAt < d ? e.createdAt : d), now);
  const payable = net >= SETTLEMENT_MIN_PAYOUT;

  const settlement = await tx.settlement.create({
    data: {
      number: await nextSettlementNumber(tx, now), organizationId,
      periodStart: previous?.periodEnd ?? earliest, periodEnd: now,
      credits, debits, carriedIn, net,
      status: !payable ? "CARRIED_FORWARD" : account?.verifiedAt ? "APPROVED" : "DRAFT",
    },
  });
  await tx.ledgerEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) }, settlementId: null }, data: { settlementId: settlement.id } });
  const openIds = open.map((s) => s.id);
  await tx.settlement.updateMany({ where: { id: { in: openIds }, status: "DRAFT" }, data: { status: "CARRIED_FORWARD" } });
  await tx.settlement.updateMany({ where: { id: { in: openIds } }, data: { carriedIntoId: settlement.id } });
  return settlement;
}

/** Organizations with something to settle: available entries, or unpaid nets waiting to roll forward */
export async function organizationsToSettle(prisma: PrismaClient, now: Date): Promise<string[]> {
  const [withEntries, withOpen] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { settlementId: null, availableAt: { lte: now } }, select: { organizationId: true }, distinct: ["organizationId"] }),
    prisma.settlement.findMany({ where: { status: { in: [...OPEN_SETTLEMENT_STATUSES] }, carriedIntoId: null }, select: { organizationId: true }, distinct: ["organizationId"] }),
  ]);
  return [...new Set([...withEntries, ...withOpen].map((r) => r.organizationId))];
}

/** One run per organization per week, claimed in the same transaction that writes the settlement */
export async function runWeeklySettlement(prisma: PrismaClient, organizationId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const key = `stl:${organizationId}:${istWeekStart(now).toISOString().slice(0, 10)}`;
    const { count } = await tx.alertOnce.createMany({ data: [{ key }], skipDuplicates: true });
    if (count === 0) return null;
    return settleOrganization(tx, organizationId, now);
  });
}

/**
 * A balance negative for BALANCE_DUE_WEEKS runs in a row and above the threshold becomes a due the owner pays
 * Martly. Returns the new due, or null when none was raised.
 */
export async function raiseDueIfOverdue(prisma: PrismaClient, organizationId: string) {
  const recent = await prisma.settlement.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: BALANCE_DUE_WEEKS });
  if (recent.length < BALANCE_DUE_WEEKS || recent.some((s) => Number(s.net) >= 0 || s.status !== "CARRIED_FORWARD")) return null;
  const owed = -Number(recent[0].net);
  if (owed <= BALANCE_DUE_THRESHOLD) return null;
  const pending = await prisma.balanceDue.findFirst({ where: { organizationId, status: "PENDING" } });
  if (pending) return null;
  return prisma.balanceDue.create({ data: { organizationId, amount: owed } });
}

/** Records bank or UPI payouts for scheduled settlements; each posts a payout entry that zeroes its net */
export async function markSettlementsPaid(prisma: PrismaClient, input: MarkSettlementsPaidInput, paidBy: string) {
  const paid: Settlement[] = [];
  for (const id of input.ids) {
    const settlement = await prisma.$transaction(async (tx) => {
      const claim = await tx.settlement.updateMany({
        where: { id, status: "APPROVED" },
        data: { status: "PAID", payoutMethod: input.method, utr: input.utr, paidAt: new Date(), paidBy },
      });
      if (claim.count === 0) return null;
      const s = await tx.settlement.findUniqueOrThrow({ where: { id } });
      await postEntries(tx, [{
        organizationId: s.organizationId, type: "SETTLEMENT_PAYOUT", amount: -Number(s.net), sourceType: "SETTLEMENT",
        sourceId: s.id, settlementId: s.id, memo: `Payout ${s.number} · UTR ${input.utr}`, createdBy: paidBy,
      }]);
      return s;
    });
    if (settlement) paid.push(settlement);
  }
  return paid;
}

/** The bank rejected a payout: its net rolls into the next run once the owner fixes their details */
export async function markSettlementFailed(prisma: PrismaClient, id: string, reason: string) {
  const claim = await prisma.settlement.updateMany({ where: { id, status: "APPROVED" }, data: { status: "FAILED", failureReason: reason } });
  if (claim.count === 0) throw httpError("Only scheduled payouts can be marked failed");
  return prisma.settlement.findUniqueOrThrow({ where: { id } });
}

/** Schedules settlements that were waiting for bank details, once those are verified */
export async function approveSettlements(prisma: PrismaClient, ids: string[]) {
  const drafts = await prisma.settlement.findMany({
    where: { id: { in: ids }, status: "DRAFT", carriedIntoId: null, organization: { payoutAccount: { verifiedAt: { not: null } } } },
    select: { id: true },
  });
  await prisma.settlement.updateMany({ where: { id: { in: drafts.map((d) => d.id) }, status: "DRAFT" }, data: { status: "APPROVED" } });
  return prisma.settlement.findMany({ where: { id: { in: drafts.map((d) => d.id) } } });
}
