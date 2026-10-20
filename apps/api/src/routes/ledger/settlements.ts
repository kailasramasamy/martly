import type { FastifyInstance } from "fastify";
import { Permission } from "@martly/shared/constants";
import { type SettlementQuery, settlementQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import type { Prisma, PrismaClient, Settlement } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { statementLink } from "../../services/ledger/statement.js";
import { financeScope, requireOwner } from "./scope.js";

const finance = { preHandler: [authenticate, requirePermission(Permission.FINANCE_MANAGE)] };

export function serializeSettlement(s: Settlement & { organization?: { name: string } }) {
  return {
    id: s.id, number: s.number, organizationId: s.organizationId, organizationName: s.organization?.name ?? null,
    periodStart: s.periodStart, periodEnd: s.periodEnd,
    credits: Number(s.credits), debits: Number(s.debits), carriedIn: Number(s.carriedIn), net: Number(s.net),
    status: s.status, payoutMethod: s.payoutMethod, utr: s.utr, paidAt: s.paidAt, failureReason: s.failureReason,
    carriedIntoId: s.carriedIntoId, createdAt: s.createdAt,
  };
}

function settlementWhere(organizationId: string, q: SettlementQuery): Prisma.SettlementWhereInput {
  return {
    organizationId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.from ? { periodEnd: { gte: new Date(`${q.from}T00:00:00+05:30`) } } : {}),
    ...(q.to ? { periodStart: { lte: new Date(`${q.to}T23:59:59.999+05:30`) } } : {}),
    ...(q.q ? { OR: [
      { number: { contains: q.q, mode: "insensitive" as const } },
      { utr: { contains: q.q, mode: "insensitive" as const } },
    ] } : {}),
  };
}

/** Each store's credits and debits by entry type, for the statement view */
async function breakdown(prisma: PrismaClient, s: Settlement) {
  const [groups, stores] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["storeId", "type"], where: { settlementId: s.id, type: { not: "SETTLEMENT_PAYOUT" } }, _sum: { amount: true }, _count: true,
    }),
    prisma.store.findMany({ where: { organizationId: s.organizationId }, select: { id: true, name: true } }),
  ]);
  const names = new Map(stores.map((st) => [st.id, st.name]));
  const byStore = new Map<string, { storeId: string | null; name: string; total: number; lines: { type: string; count: number; amount: number }[] }>();
  for (const g of groups) {
    const key = g.storeId ?? "";
    const section = byStore.get(key) ?? { storeId: g.storeId, name: g.storeId ? names.get(g.storeId) ?? "Store" : "Organization", total: 0, lines: [] };
    const amount = Number(g._sum.amount ?? 0);
    section.total += amount;
    section.lines.push({ type: g.type, count: g._count, amount });
    byStore.set(key, section);
  }
  return [...byStore.values()];
}

/** Owners' payout history and statements */
export async function settlementRoutes(app: FastifyInstance) {
  app.get("/settlements", finance, async (request) => {
    const query = settlementQuerySchema.parse(request.query);
    const scope = await financeScope(request, app.prisma, query);
    requireOwner(scope);
    const { page, pageSize } = query;
    const where = settlementWhere(scope.organizationId, query);
    const [rows, total] = await Promise.all([
      app.prisma.settlement.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.settlement.count({ where }),
    ]);
    return {
      success: true, data: rows.map(serializeSettlement),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    } satisfies PaginatedResponse<ReturnType<typeof serializeSettlement>>;
  });

  app.get<{ Params: { id: string } }>("/settlements/:id", finance, async (request, reply) => {
    const s = await app.prisma.settlement.findUnique({ where: { id: request.params.id }, include: { organization: { select: { name: true } } } });
    if (!s) return reply.notFound("Settlement not found");
    const scope = await financeScope(request, app.prisma, { organizationId: s.organizationId });
    requireOwner(scope);
    if (scope.organizationId !== s.organizationId) return reply.notFound("Settlement not found");
    const carriedFrom = await app.prisma.settlement.findMany({ where: { carriedIntoId: s.id }, select: { id: true, number: true, net: true, status: true } });
    return {
      success: true,
      data: {
        ...serializeSettlement(s),
        stores: await breakdown(app.prisma, s),
        carriedFrom: carriedFrom.map((c) => ({ ...c, net: Number(c.net) })),
        statementUrl: statementLink(s.id),
      },
    } satisfies ApiResponse<unknown>;
  });
}
