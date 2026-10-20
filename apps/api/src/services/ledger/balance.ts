import { SETTLEMENT_HOUR_IST, SETTLEMENT_WEEKDAY } from "@martly/shared/constants";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { money } from "./post.js";

type Db = PrismaClient | Prisma.TransactionClient;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Nets not yet paid out or rolled into a later settlement */
export const OPEN_SETTLEMENT_STATUSES = ["DRAFT", "CARRIED_FORWARD", "FAILED"] as const;

/** Whose entries a view covers: a whole organization, or only some of its stores (store-scoped finance staff) */
export interface LedgerScope {
  organizationId: string;
  storeIds?: string[];
}

const sum = (agg: { _sum: { amount: Prisma.Decimal | null } }) => Number(agg._sum.amount ?? 0);

export function scopeWhere(scope: LedgerScope): Prisma.LedgerEntryWhereInput {
  return { organizationId: scope.organizationId, ...(scope.storeIds ? { storeId: { in: scope.storeIds } } : {}) };
}

/** The next weekly run: Monday 06:00 IST */
export function nextSettlementRun(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const run = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), SETTLEMENT_HOUR_IST) - IST_OFFSET_MS);
  const days = (SETTLEMENT_WEEKDAY - ist.getUTCDay() + 7) % 7;
  const candidate = new Date(run.getTime() + days * DAY_MS);
  return candidate > now ? candidate : new Date(candidate.getTime() + 7 * DAY_MS);
}

/** Monday 00:00 IST of the week containing `now` */
export function istWeekStart(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const back = (ist.getUTCDay() - SETTLEMENT_WEEKDAY + 7) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back) - IST_OFFSET_MS);
}

/** Unsettled money split by whether the return window has passed */
export async function unsettledTotals(db: Db, scope: LedgerScope, now = new Date()) {
  const where = { ...scopeWhere(scope), settlementId: null };
  const [available, onHold] = await Promise.all([
    db.ledgerEntry.aggregate({ where: { ...where, availableAt: { lte: now } }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { ...where, availableAt: { gt: now } }, _sum: { amount: true } }),
  ]);
  return { available: sum(available), onHold: sum(onHold) };
}

/** Nets of earlier settlements that weren't paid and roll into the next run */
export async function carriedBalance(db: Db, organizationId: string) {
  const agg = await db.settlement.aggregate({
    where: { organizationId, status: { in: [...OPEN_SETTLEMENT_STATUSES] }, carriedIntoId: null },
    _sum: { net: true },
  });
  return Number(agg._sum.net ?? 0);
}

/** What the organization can spend or must repay now: available entries plus carried nets */
export async function spendableBalance(db: Db, organizationId: string, now = new Date()) {
  const [{ available }, carried] = await Promise.all([unsettledTotals(db, { organizationId }, now), carriedBalance(db, organizationId)]);
  return available + carried;
}

/** Cash on delivery collected by the stores this week, shown for information (the store already holds it) */
export async function codCollectedThisWeek(db: Db, scope: LedgerScope, now = new Date()) {
  const orders = await db.order.findMany({
    where: {
      store: { organizationId: scope.organizationId },
      ...(scope.storeIds ? { storeId: { in: scope.storeIds } } : {}),
      paymentMethod: "COD", codCollectedVia: { not: null }, status: "DELIVERED",
      statusLogs: { some: { status: "DELIVERED", createdAt: { gte: istWeekStart(now) } } },
    },
    select: { totalAmount: true, walletAmountUsed: true, loyaltyPointsUsed: true, refusedAmount: true },
  });
  return money(orders.reduce((n, o) => n + Number(o.totalAmount) - Number(o.walletAmountUsed ?? 0) - (o.loyaltyPointsUsed ?? 0) - Number(o.refusedAmount), 0));
}

/** Unsettled totals per store, for the store breakdown on the overview */
export async function perStoreTotals(db: Db, scope: LedgerScope, now = new Date()) {
  const where = { ...scopeWhere(scope), settlementId: null, storeId: scope.storeIds ? { in: scope.storeIds } : { not: null } };
  const [available, onHold, stores] = await Promise.all([
    db.ledgerEntry.groupBy({ by: ["storeId"], where: { ...where, availableAt: { lte: now } }, _sum: { amount: true } }),
    db.ledgerEntry.groupBy({ by: ["storeId"], where: { ...where, availableAt: { gt: now } }, _sum: { amount: true } }),
    db.store.findMany({
      where: { organizationId: scope.organizationId, ...(scope.storeIds ? { id: { in: scope.storeIds } } : {}) },
      select: { id: true, name: true }, orderBy: { name: "asc" },
    }),
  ]);
  const of = (rows: typeof available, id: string) => Number(rows.find((r) => r.storeId === id)?._sum.amount ?? 0);
  return stores.map((s) => ({ storeId: s.id, name: s.name, available: of(available, s.id), onHold: of(onHold, s.id) }));
}
