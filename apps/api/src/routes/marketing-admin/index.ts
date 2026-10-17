import type { FastifyInstance } from "fastify";
import { updateAdPricingSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getMarketingConfig } from "../../services/marketing/config.js";
import { invoiceLink } from "../../services/marketing/invoice.js";
import { istDateKey } from "../../services/ist-day.js";

const platform = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };

async function pricing(app: FastifyInstance) {
  const [products, config] = await Promise.all([
    app.prisma.adProduct.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    getMarketingConfig(app.prisma),
  ]);
  return { products: products.map((p) => ({ ...p, price: Number(p.price) })), config };
}

/** Martly's side of paid marketing: the price list, settings, every order and who is on which plan */
export async function marketingAdminRoutes(app: FastifyInstance) {
  app.get("/pricing", platform, async () => ({ success: true, data: await pricing(app) }));

  // Packages are never deleted (orders point at them); switching isActive off takes one off sale
  app.put("/pricing", platform, async (request, reply) => {
    const { products, config } = updateAdPricingSchema.parse(request.body);
    const codes = products.map((p) => p.code);
    if (new Set(codes).size !== codes.length) return reply.badRequest("Each package needs its own code");
    await app.prisma.$transaction([
      ...products.map(({ id, ...data }) =>
        id
          ? app.prisma.adProduct.update({ where: { id }, data: { ...data, placement: data.placement ?? null } })
          : app.prisma.adProduct.create({ data: { ...data, placement: data.placement ?? null } })),
      app.prisma.marketingConfig.update({ where: { id: "default" }, data: { ...config, sellerGstin: config.sellerGstin || null } }),
    ]);
    return { success: true, data: await pricing(app) };
  });

  app.get<{ Querystring: { page?: string; pageSize?: string; status?: string; kind?: string } }>("/orders", platform, async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const pageSize = Math.min(Number(request.query.pageSize) || 20, 100);
    const where = {
      ...(request.query.status ? { status: request.query.status as "PAID" } : {}),
      ...(request.query.kind ? { product: { kind: request.query.kind as "STORE_PLAN" } } : {}),
    };
    const monthStart = new Date(`${istDateKey(new Date()).slice(0, 8)}01T00:00:00+05:30`);
    const [rows, total, allTime, thisMonth] = await Promise.all([
      app.prisma.adOrder.findMany({
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { product: { select: { name: true, kind: true } }, organization: { select: { name: true } }, brand: { select: { name: true } } },
      }),
      app.prisma.adOrder.count({ where }),
      app.prisma.adOrder.aggregate({ where: { status: "PAID" }, _sum: { total: true, subtotal: true }, _count: true }),
      app.prisma.adOrder.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { total: true, subtotal: true }, _count: true }),
    ]);
    const sum = (a: typeof allTime) => ({ orders: a._count, total: Number(a._sum.total ?? 0), net: Number(a._sum.subtotal ?? 0) });
    return {
      success: true,
      data: rows.map((o) => ({
        ...o, unitPrice: Number(o.unitPrice), subtotal: Number(o.subtotal), total: Number(o.total),
        cgst: Number(o.cgst), sgst: Number(o.sgst), igst: Number(o.igst), invoiceUrl: o.number ? invoiceLink(o.id) : null,
      })),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize), revenue: { allTime: sum(allTime), thisMonth: sum(thisMonth) } },
    };
  });

  // Every organisation with the plan it's on today (Free when no paid period covers now)
  app.get("/subscribers", platform, async () => {
    const now = new Date();
    const orgs = await app.prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true,
        planPeriods: {
          where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" },
          select: { startsAt: true, endsAt: true, product: { select: { name: true, code: true } } },
        },
      },
    });
    return {
      success: true,
      data: orgs.map(({ planPeriods, ...org }) => {
        const current = planPeriods.find((p) => p.startsAt <= now);
        return { ...org, plan: current?.product ?? null, currentUntil: current?.endsAt ?? null, paidThrough: planPeriods.at(-1)?.endsAt ?? null };
      }),
    };
  });
}
