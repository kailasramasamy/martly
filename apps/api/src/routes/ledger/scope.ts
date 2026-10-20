import type { FastifyRequest } from "fastify";
import { LedgerEntryGroup, type LedgerEntryState } from "@martly/shared/constants";
import type { LedgerQuery } from "@martly/shared/schemas";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getOrgStoreIds, getOrgUser } from "../../middleware/org-scope.js";
import type { LedgerScope } from "../../services/ledger/balance.js";
import { formatOrderRef } from "../../services/notify/copy.js";

export interface FinanceScope extends LedgerScope {
  /** Owners (and Martly) see org-level entries, payouts and bank details; store finance staff see their stores only */
  isOwner: boolean;
}

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/** Resolves whose ledger the request may see, narrowed to one store when asked */
export async function financeScope(
  request: FastifyRequest, prisma: PrismaClient, query: { organizationId?: string; storeId?: string },
): Promise<FinanceScope> {
  const user = getOrgUser(request);
  const organizationId = user.role === "SUPER_ADMIN" ? query.organizationId : user.organizationId;
  if (!organizationId) throw httpError(user.role === "SUPER_ADMIN" ? "Choose an organization" : "Organization context required", 400);
  const isOwner = user.role === "SUPER_ADMIN" || user.role === "ORG_ADMIN";
  const allowed = isOwner ? undefined : await getOrgStoreIds(request, prisma);
  if (!query.storeId) return { organizationId, storeIds: allowed, isOwner };

  const store = await prisma.store.findFirst({ where: { id: query.storeId, organizationId }, select: { id: true } });
  if (!store || (allowed && !allowed.includes(store.id))) throw httpError("You can't see this store's payments", 403);
  return { organizationId, storeIds: [store.id], isOwner };
}

export function requireOwner(scope: FinanceScope) {
  if (!scope.isOwner) throw httpError("Only the owner can see payouts and bank details", 403);
}

function stateWhere(state: LedgerEntryState | undefined, now: Date): Prisma.LedgerEntryWhereInput {
  if (state === "SETTLED") return { settlementId: { not: null } };
  if (state === "ON_HOLD") return { settlementId: null, availableAt: { gt: now } };
  if (state === "AVAILABLE") return { settlementId: null, availableAt: { lte: now } };
  return {};
}

/** Filters for the activity list and its CSV export */
export function entryWhere(scope: FinanceScope, q: LedgerQuery, now = new Date()): Prisma.LedgerEntryWhereInput {
  const types = q.type ? [q.type] : q.group ? [...LedgerEntryGroup[q.group]] : undefined;
  return {
    organizationId: scope.organizationId,
    ...(scope.storeIds ? { storeId: { in: scope.storeIds } } : {}),
    ...(types ? { type: { in: types } } : {}),
    ...(q.settlementId ? { settlementId: q.settlementId } : {}),
    ...stateWhere(q.state, now),
    ...(q.from || q.to ? { createdAt: {
      ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}),
      ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999+05:30`) } : {}),
    } } : {}),
    ...(q.q ? { memo: { contains: q.q, mode: "insensitive" as const } } : {}),
  };
}

export const ENTRY_INCLUDE = {
  store: { select: { name: true } },
  settlement: { select: { number: true, status: true } },
} as const;

type EntryRow = Prisma.LedgerEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

export function serializeEntry(e: EntryRow, now = new Date()) {
  const state: LedgerEntryState = e.settlementId ? "SETTLED" : e.availableAt > now ? "ON_HOLD" : "AVAILABLE";
  return {
    id: e.id, type: e.type, amount: Number(e.amount), memo: e.memo, state,
    storeId: e.storeId, storeName: e.store?.name ?? null,
    orderId: e.orderId, orderRef: e.orderId ? formatOrderRef(e.orderId) : null,
    returnRequestId: e.sourceType === "RETURN" ? e.sourceId : null,
    sourceType: e.sourceType, availableAt: e.availableAt, createdAt: e.createdAt,
    settlementId: e.settlementId, settlementNumber: e.settlement?.number ?? null,
  };
}
export type SerializedEntry = ReturnType<typeof serializeEntry>;

export const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v instanceof Date ? v.toISOString() : v);
  // A leading = + @ would run as a formula in a spreadsheet
  const safe = /^[=+@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: SerializedEntry[]): string {
  const head = ["Date", "Store", "Type", "Memo", "Amount", "Order", "Status", "Available from", "Settlement"];
  const lines = rows.map((r) => [r.createdAt, r.storeName ?? "Organization", r.type, r.memo, r.amount.toFixed(2), r.orderRef, r.state, r.availableAt, r.settlementNumber]);
  return [head, ...lines].map((l) => l.map(csvCell).join(",")).join("\n");
}
