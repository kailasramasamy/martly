import type { FastifyInstance } from "fastify";
import { Permission } from "@martly/shared/constants";
import { balanceDueVerifySchema, ledgerQueryMessageSchema, ledgerQuerySchema, payoutAccountSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import {
  carriedBalance, codCollectedThisWeek, nextSettlementRun, perStoreTotals, unsettledTotals,
} from "../../services/ledger/balance.js";
import { dueCheckout, openDue, settleDue } from "../../services/ledger/dues.js";
import { publicPayoutAccount, savePayoutAccount } from "../../services/ledger/payout-account.js";
import { renderStatement, statementLinkValid } from "../../services/ledger/statement.js";
import { notifyLedgerQuery, notifyPayoutAccountChanged } from "../../services/notify/finance-alerts.js";
import { verifyRazorpaySignature } from "../../services/payment.js";
import { ENTRY_INCLUDE, type SerializedEntry, entryWhere, financeScope, requireOwner, serializeEntry, toCsv } from "./scope.js";
import { settlementRoutes } from "./settlements.js";
import { platformLedgerRoutes } from "./platform.js";

const finance = { preHandler: [authenticate, requirePermission(Permission.FINANCE_MANAGE)] };
type ScopeQuery = { organizationId?: string; storeId?: string };
const EXPORT_LIMIT = 5000;

export async function ledgerRoutes(app: FastifyInstance) {
  // Overview: balances, the next and last payouts, and each store's share
  app.get("/summary", finance, async (request) => {
    const scope = await financeScope(request, app.prisma, request.query as ScopeQuery);
    const now = new Date();
    const [totals, stores, cod, rates] = await Promise.all([
      unsettledTotals(app.prisma, scope, now),
      perStoreTotals(app.prisma, scope, now),
      codCollectedThisWeek(app.prisma, scope, now),
      app.prisma.organization.findUniqueOrThrow({ where: { id: scope.organizationId }, select: { onlineCommissionPct: true, codCommissionPct: true } }),
    ]);
    const commission = { onlinePct: Number(rates.onlineCommissionPct), codPct: Number(rates.codCommissionPct) };
    const owner = scope.isOwner && !scope.storeIds ? await ownerSummary(app, scope.organizationId) : null;
    return {
      success: true,
      data: { ...totals, codThisWeek: cod, commission, nextRunAt: nextSettlementRun(now), stores, isOwner: scope.isOwner, owner },
    } satisfies ApiResponse<unknown>;
  });

  // Signed links open statements in any browser, so they need no token
  app.get<{ Params: { id: string }; Querystring: { expires?: string; sig?: string } }>("/statements/:id", async (request, reply) => {
    if (!statementLinkValid(request.params.id, Number(request.query.expires), request.query.sig ?? "")) return reply.forbidden("This link has expired");
    const html = await renderStatement(app.prisma, request.params.id);
    if (!html) return reply.notFound("Statement not found");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  activityRoutes(app);
  entryQueryRoute(app);
  payoutAccountRoutes(app);
  dueRoutes(app);
  await app.register(settlementRoutes);
  await app.register(platformLedgerRoutes, { prefix: "/platform" });
}

function activityRoutes(app: FastifyInstance) {
  // Activity: every entry, filtered by tab, store, status and date
  app.get("/", finance, async (request) => {
    const q = ledgerQuerySchema.parse(request.query);
    const scope = await financeScope(request, app.prisma, q);
    const where = entryWhere(scope, q);
    const [rows, total] = await Promise.all([
      app.prisma.ledgerEntry.findMany({ where, include: ENTRY_INCLUDE, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      app.prisma.ledgerEntry.count({ where }),
    ]);
    return {
      success: true,
      data: rows.map((r) => serializeEntry(r)),
      meta: { total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) },
    } satisfies PaginatedResponse<SerializedEntry>;
  });

  app.get("/export.csv", finance, async (request, reply) => {
    const q = ledgerQuerySchema.parse(request.query);
    const scope = await financeScope(request, app.prisma, q);
    const rows = await app.prisma.ledgerEntry.findMany({ where: entryWhere(scope, q), include: ENTRY_INCLUDE, orderBy: { createdAt: "desc" }, take: EXPORT_LIMIT });
    reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", 'attachment; filename="ledger.csv"');
    return toCsv(rows.map((r) => serializeEntry(r)));
  });

  app.get<{ Params: { id: string } }>("/entries/:id", finance, async (request, reply) => {
    const entry = await app.prisma.ledgerEntry.findUnique({ where: { id: request.params.id }, include: ENTRY_INCLUDE });
    if (!entry) return reply.notFound("Entry not found");
    const scope = await financeScope(request, app.prisma, { organizationId: entry.organizationId });
    if (entry.organizationId !== scope.organizationId) return reply.notFound("Entry not found");
    if (scope.storeIds && (!entry.storeId || !scope.storeIds.includes(entry.storeId))) return reply.notFound("Entry not found");
    return { success: true, data: serializeEntry(entry) } satisfies ApiResponse<SerializedEntry>;
  });
}

function entryQueryRoute(app: FastifyInstance) {
  // A question about an entry goes to Martly as a support ticket; it has no organization, so only Martly sees it
  app.post<{ Params: { id: string } }>("/entries/:id/query", finance, async (request, reply) => {
    const { message } = ledgerQueryMessageSchema.parse(request.body);
    const entry = await app.prisma.ledgerEntry.findUnique({ where: { id: request.params.id }, include: { organization: { select: { name: true } } } });
    const scope = entry ? await financeScope(request, app.prisma, { organizationId: entry.organizationId }) : null;
    if (!entry || !scope || entry.organizationId !== scope.organizationId) return reply.notFound("Entry not found");
    if (scope.storeIds && (!entry.storeId || !scope.storeIds.includes(entry.storeId))) return reply.notFound("Entry not found");
    const content = `${message}\n\nEntry: ${entry.memo} · ${entry.type} · ₹${Number(entry.amount)} · ${entry.id}`;
    const ticket = await app.prisma.supportTicket.create({
      data: {
        userId: request.user.sub, orderId: entry.orderId, subject: `Ledger query · ${entry.organization.name} · ${entry.memo}`.slice(0, 190),
        messages: [{ role: "user", content, timestamp: new Date().toISOString() }],
      },
    });
    void notifyLedgerQuery(app.fcm, app.prisma, entry.organization.name, entry.memo).catch((err: unknown) => app.log.error(err, "Ledger query alert failed"));
    return reply.code(201).send({ success: true, data: { ticketId: ticket.id } } satisfies ApiResponse<{ ticketId: string }>);
  });
}

/** Org-wide figures only owners see: carried nets, payouts and anything due */
async function ownerSummary(app: FastifyInstance, organizationId: string) {
  const [carried, next, last, due, account] = await Promise.all([
    carriedBalance(app.prisma, organizationId),
    app.prisma.settlement.findFirst({ where: { organizationId, status: { in: ["APPROVED", "DRAFT"] }, carriedIntoId: null }, orderBy: { createdAt: "desc" } }),
    app.prisma.settlement.findFirst({ where: { organizationId, status: "PAID" }, orderBy: { paidAt: "desc" } }),
    app.prisma.balanceDue.findFirst({ where: { organizationId, status: "PENDING" } }),
    app.prisma.orgPayoutAccount.findUnique({ where: { organizationId } }),
  ]);
  return {
    carried,
    nextPayout: next ? { id: next.id, number: next.number, amount: Number(next.net), status: next.status } : null,
    lastPayout: last ? { id: last.id, number: last.number, amount: Number(last.net), utr: last.utr, paidAt: last.paidAt } : null,
    due: due ? { id: due.id, amount: Number(due.amount), createdAt: due.createdAt } : null,
    payoutAccount: publicPayoutAccount(account),
  };
}

function payoutAccountRoutes(app: FastifyInstance) {
  app.get("/payout-account", finance, async (request) => {
    const scope = await financeScope(request, app.prisma, request.query as ScopeQuery);
    requireOwner(scope);
    const account = await app.prisma.orgPayoutAccount.findUnique({ where: { organizationId: scope.organizationId } });
    return { success: true, data: publicPayoutAccount(account) } satisfies ApiResponse<unknown>;
  });

  // Only the owner sets where money goes; every change pauses payouts and alerts all owners
  app.put("/payout-account", finance, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "ORG_ADMIN" || !user.organizationId) return reply.forbidden("Only the owner can change payout details");
    const input = payoutAccountSchema.parse(request.body);
    const account = await savePayoutAccount(app.prisma, user.organizationId, input, user.sub);
    void notifyPayoutAccountChanged(app.fcm, app.prisma, user.organizationId, user.sub).catch((err: unknown) => app.log.error(err, "Payout account alert failed"));
    return { success: true, data: publicPayoutAccount(account) } satisfies ApiResponse<unknown>;
  });
}

function dueRoutes(app: FastifyInstance) {
  // The owner pays what refunds left owing, from the app
  app.post("/dues/pay", finance, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "ORG_ADMIN" || !user.organizationId) return reply.forbidden("Only the owner can pay dues");
    const due = await openDue(app.prisma, user.organizationId);
    return { success: true, data: await dueCheckout(app.prisma, due) } satisfies ApiResponse<unknown>;
  });

  app.post("/dues/verify", finance, async (request, reply) => {
    const user = getOrgUser(request);
    const body = balanceDueVerifySchema.parse(request.body);
    if (!verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return reply.badRequest("Payment verification failed");
    }
    const due = await app.prisma.balanceDue.findUnique({ where: { razorpayOrderId: body.razorpay_order_id } });
    if (!due || due.organizationId !== user.organizationId) return reply.notFound("Due not found");
    await settleDue(app.prisma, app.fcm, due.id, { paymentId: body.razorpay_payment_id, by: user.sub });
    return { success: true, data: { paid: true } } satisfies ApiResponse<{ paid: boolean }>;
  });
}
