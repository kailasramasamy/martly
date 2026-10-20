import type { FastifyInstance } from "fastify";
import {
  balanceDueOfflineSchema, ledgerAdjustmentSchema, ledgerQuerySchema, markSettlementFailedSchema, markSettlementsPaidSchema, settlementIdsSchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import type { SettlementStatus } from "../../../generated/prisma/index.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { OPEN_SETTLEMENT_STATUSES } from "../../services/ledger/balance.js";
import { settleDue } from "../../services/ledger/dues.js";
import { decryptAccountNumber, publicPayoutAccount, verifyPayoutAccount } from "../../services/ledger/payout-account.js";
import { postEntries } from "../../services/ledger/post.js";
import { approveSettlements, markSettlementFailed, markSettlementsPaid } from "../../services/ledger/settlement.js";
import { notifyAdjustment, notifyPayoutFailed, notifyPayoutPaid, notifySettlement } from "../../services/notify/finance-alerts.js";
import { ENTRY_INCLUDE, csvCell, serializeEntry } from "./scope.js";
import { serializeSettlement } from "./settlements.js";

const platform = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };
const sumBy = (rows: { organizationId: string; _sum: Record<string, unknown> }[], id: string, field: string) =>
  Number(rows.find((r) => r.organizationId === id)?._sum[field] ?? 0);

/** Martly's view across organizations: balances, the payout queue, bank verification, adjustments and dues */
export async function platformLedgerRoutes(app: FastifyInstance) {
  app.get("/balances", platform, async () => {
    const now = new Date();
    const unsettled = { settlementId: null };
    const [orgs, available, onHold, open, scheduled, dues, accounts] = await Promise.all([
      app.prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      app.prisma.ledgerEntry.groupBy({ by: ["organizationId"], where: { ...unsettled, availableAt: { lte: now } }, _sum: { amount: true } }),
      app.prisma.ledgerEntry.groupBy({ by: ["organizationId"], where: { ...unsettled, availableAt: { gt: now } }, _sum: { amount: true } }),
      app.prisma.settlement.groupBy({ by: ["organizationId"], where: { status: { in: [...OPEN_SETTLEMENT_STATUSES] }, carriedIntoId: null }, _sum: { net: true } }),
      app.prisma.settlement.groupBy({ by: ["organizationId"], where: { status: "APPROVED" }, _sum: { net: true } }),
      app.prisma.balanceDue.groupBy({ by: ["organizationId"], where: { status: "PENDING" }, _sum: { amount: true } }),
      app.prisma.orgPayoutAccount.findMany({ select: { organizationId: true, verifiedAt: true } }),
    ]);
    const data = orgs.map((o) => {
      const account = accounts.find((a) => a.organizationId === o.id);
      const avail = sumBy(available, o.id, "amount");
      const carried = sumBy(open, o.id, "net");
      return {
        organizationId: o.id, name: o.name, available: avail, onHold: sumBy(onHold, o.id, "amount"), carried,
        balance: avail + carried, scheduled: sumBy(scheduled, o.id, "net"), due: sumBy(dues, o.id, "amount"),
        payoutAccount: account ? (account.verifiedAt ? "VERIFIED" : "PENDING") : "MISSING",
      };
    });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  settlementQueueRoutes(app);
  accountRoutes(app);
  adjustmentHistoryRoute(app);
  adjustmentAndDueRoutes(app);
}

function settlementQueueRoutes(app: FastifyInstance) {
  app.get("/settlements", platform, async (request) => {
    const { status, organizationId } = request.query as { status?: SettlementStatus; organizationId?: string };
    const rows = await app.prisma.settlement.findMany({
      where: { ...(status ? { status } : {}), ...(organizationId ? { organizationId } : {}) },
      include: { organization: { select: { name: true, payoutAccount: { select: { verifiedAt: true, accountLast4: true, upiVpa: true } } } } },
      orderBy: { createdAt: "desc" }, take: 500,
    });
    const data = rows.map((s) => ({ ...serializeSettlement(s), payoutAccount: publicPayoutAccountSummary(s.organization.payoutAccount) }));
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post("/settlements/approve", platform, async (request) => {
    const { ids } = settlementIdsSchema.parse(request.body);
    const approved = await approveSettlements(app.prisma, ids);
    for (const s of approved) void notifySettlement(app.fcm, app.prisma, s).catch((err: unknown) => app.log.error(err, "Settlement alert failed"));
    return { success: true, data: { approved: approved.length } } satisfies ApiResponse<{ approved: number }>;
  });

  app.post("/settlements/mark-paid", platform, async (request) => {
    const input = markSettlementsPaidSchema.parse(request.body);
    const paid = await markSettlementsPaid(app.prisma, input, request.user.sub);
    for (const s of paid) void notifyPayoutPaid(app.fcm, app.prisma, s).catch((err: unknown) => app.log.error(err, "Payout alert failed"));
    return { success: true, data: { paid: paid.length } } satisfies ApiResponse<{ paid: number }>;
  });

  app.post<{ Params: { id: string } }>("/settlements/:id/fail", platform, async (request) => {
    const { reason } = markSettlementFailedSchema.parse(request.body);
    const s = await markSettlementFailed(app.prisma, request.params.id, reason);
    void notifyPayoutFailed(app.fcm, app.prisma, s).catch((err: unknown) => app.log.error(err, "Payout failed alert failed"));
    return { success: true, data: serializeSettlement(s) } satisfies ApiResponse<unknown>;
  });

  bankExportRoute(app);
}

function bankExportRoute(app: FastifyInstance) {
  // Bank bulk-upload file for scheduled payouts; the only place a full account number leaves the database
  app.get("/settlements/bank-export.csv", platform, async (request, reply) => {
    const ids = String((request.query as { ids?: string }).ids ?? "").split(",").filter(Boolean);
    const rows = await app.prisma.settlement.findMany({
      where: { id: { in: ids }, status: "APPROVED" },
      include: { organization: { select: { name: true, payoutAccount: true } } },
    });
    const lines = rows.map((s) => {
      const a = s.organization.payoutAccount;
      const account = a?.accountNumberEnc ? decryptAccountNumber(a.accountNumberEnc) : "";
      return [s.number, s.organization.name, a?.accountHolder ?? "", account, a?.ifsc ?? "", a?.upiVpa ?? "", Number(s.net).toFixed(2)];
    });
    const csv = [["Reference", "Organization", "Beneficiary", "Account number", "IFSC", "UPI ID", "Amount"], ...lines]
      .map((l) => l.map(csvCell).join(",")).join("\n");
    app.log.info({ by: request.user.sub, settlements: rows.map((s) => s.number) }, "Payout bank file exported");
    reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", 'attachment; filename="payouts.csv"');
    return csv;
  });
}

function publicPayoutAccountSummary(a: { verifiedAt: Date | null; accountLast4: string | null; upiVpa: string | null } | null) {
  return a ? { verified: !!a.verifiedAt, accountLast4: a.accountLast4, upiVpa: a.upiVpa } : null;
}

function accountRoutes(app: FastifyInstance) {
  app.get("/payout-accounts", platform, async (request) => {
    const pending = (request.query as { pending?: string }).pending === "true";
    const rows = await app.prisma.orgPayoutAccount.findMany({
      where: pending ? { verifiedAt: null } : {},
      include: { organization: { select: { name: true } } }, orderBy: { updatedAt: "desc" },
    });
    const data = rows.map((a) => ({ organizationId: a.organizationId, organizationName: a.organization.name, ...publicPayoutAccount(a) }));
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post<{ Params: { organizationId: string } }>("/payout-accounts/:organizationId/verify", platform, async (request) => {
    const account = await verifyPayoutAccount(app.prisma, request.params.organizationId, request.user.sub);
    return { success: true, data: publicPayoutAccount(account) } satisfies ApiResponse<unknown>;
  });
}

/** Every manual adjustment across organizations, with who recorded it */
function adjustmentHistoryRoute(app: FastifyInstance) {
  app.get("/adjustments", platform, async (request) => {
    const q = ledgerQuerySchema.parse(request.query);
    const where = {
      type: "ADJUSTMENT" as const,
      ...(q.organizationId ? { organizationId: q.organizationId } : {}),
      ...(q.from || q.to ? { createdAt: {
        ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}),
        ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999+05:30`) } : {}),
      } } : {}),
      ...(q.q ? { memo: { contains: q.q, mode: "insensitive" as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      app.prisma.ledgerEntry.findMany({
        where, include: { ...ENTRY_INCLUDE, organization: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      }),
      app.prisma.ledgerEntry.count({ where }),
    ]);
    const userIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => !!id))];
    const users = await app.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    const data = rows.map((r) => ({
      ...serializeEntry(r), organizationId: r.organizationId, organizationName: r.organization.name,
      createdByName: r.createdBy ? names.get(r.createdBy) ?? null : null,
    }));
    return {
      success: true, data, meta: { total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) },
    } satisfies PaginatedResponse<(typeof data)[number]>;
  });
}

function adjustmentAndDueRoutes(app: FastifyInstance) {
  // Audit-logged, reason required, and the owner is told
  app.post("/adjustments", platform, async (request, reply) => {
    const input = ledgerAdjustmentSchema.parse(request.body);
    if (input.storeId) {
      const store = await app.prisma.store.findFirst({ where: { id: input.storeId, organizationId: input.organizationId }, select: { id: true } });
      if (!store) return reply.badRequest("That store isn't in this organization");
    }
    await app.prisma.$transaction((tx) => postEntries(tx, [{
      organizationId: input.organizationId, storeId: input.storeId ?? null, type: "ADJUSTMENT", amount: input.amount,
      sourceType: "MANUAL", sourceId: crypto.randomUUID(), memo: `Adjustment by Martly: ${input.reason}`, createdBy: request.user.sub,
    }]));
    app.log.info({ by: request.user.sub, ...input }, "Ledger adjustment posted");
    void notifyAdjustment(app.fcm, app.prisma, input.organizationId, input.amount, input.reason).catch((err: unknown) => app.log.error(err, "Adjustment alert failed"));
    return { success: true, data: { posted: true } } satisfies ApiResponse<{ posted: boolean }>;
  });

  app.get("/dues", platform, async () => {
    const rows = await app.prisma.balanceDue.findMany({ include: { organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
    const data = rows.map((d) => ({
      id: d.id, organizationId: d.organizationId, organizationName: d.organization.name, amount: Number(d.amount),
      status: d.status, paidAt: d.paidAt, offlineReference: d.offlineReference, razorpayPaymentId: d.razorpayPaymentId, createdAt: d.createdAt,
    }));
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post<{ Params: { id: string } }>("/dues/:id/mark-paid", platform, async (request, reply) => {
    const { reference } = balanceDueOfflineSchema.parse(request.body);
    const due = await settleDue(app.prisma, app.fcm, request.params.id, { offlineReference: reference, by: request.user.sub });
    if (!due) return reply.badRequest("Only pending dues can be marked paid");
    return { success: true, data: { paid: true } } satisfies ApiResponse<{ paid: boolean }>;
  });

  app.post<{ Params: { id: string } }>("/dues/:id/cancel", platform, async (request, reply) => {
    const { count } = await app.prisma.balanceDue.updateMany({ where: { id: request.params.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (count === 0) return reply.badRequest("Only pending dues can be cancelled");
    return { success: true, data: { cancelled: true } } satisfies ApiResponse<{ cancelled: boolean }>;
  });
}
