import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgStoreIds, getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { attentionFor } from "../../services/attention.js";
import { addDays, istDay } from "../../services/ist-day.js";
import { customerCounts, dailyTotals, ordersInScope } from "../../services/dashboard-stats.js";

interface KPIs {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  averageOrderValue: number;
  previousAOV: number;
  totalCustomers: number;
  previousCustomers: number;
}

interface DashboardData {
  kpis: KPIs;
  revenueOverTime: { date: string; revenue: number }[];
  ordersOverTime: { date: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  revenueByPaymentMethod: { method: string; revenue: number; count: number }[];
  ordersByFulfillment: { type: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    customerName: string;
  }[];
}

export async function dashboardRoutes(app: FastifyInstance) {
  // Work waiting on the signed-in member, for the Today screen's "Needs your attention" card
  app.get("/attention", { preHandler: [authenticate] }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (storeId && !(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied to this store");
    }
    const orgStoreIds = await getOrgStoreIds(request, app.prisma);
    const store = storeId ? { storeId } : orgStoreIds !== undefined ? { storeId: { in: orgStoreIds } } : {};
    const items = await attentionFor(app.prisma, getOrgUser(request), store);
    return { success: true, data: items } satisfies ApiResponse<typeof items>;
  });

  app.get(
    "/stats",
    { preHandler: [authenticate, requirePermission(Permission.REPORTS_VIEW)] },
    async (request, reply) => {
      const { days: daysParam, storeId } = request.query as { days?: string; storeId?: string };
      if (storeId && !(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
        return reply.forbidden("Access denied to this store");
      }
      const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 7;

      // Stores run on India time: the period is the last `days` IST days including today, compared with the same span before it
      const todayKey = istDay().key;
      const periodStart = istDay(addDays(todayKey, -(days - 1))).start;
      const previousStart = istDay(addDays(todayKey, -(2 * days - 1))).start;

      // Org scoping
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      const storeFilter = storeId ? { storeId } : orgStoreIds !== undefined ? { storeId: { in: orgStoreIds } } : {};
      const scope = ordersInScope(storeId, orgStoreIds);

      // ── KPIs: Current Period ─────────────────────────────
      const [
        currentOrderCount,
        currentRevenueAgg,
        previousOrderCount,
        previousRevenueAgg,
        customers,
      ] = await Promise.all([
        // Current period orders
        app.prisma.order.count({
          where: { ...storeFilter, createdAt: { gte: periodStart } },
        }),
        // Current period revenue
        app.prisma.order.aggregate({
          where: { ...storeFilter, createdAt: { gte: periodStart } },
          _sum: { totalAmount: true },
        }),
        // Previous period orders
        app.prisma.order.count({
          where: { ...storeFilter, createdAt: { gte: previousStart, lt: periodStart } },
        }),
        // Previous period revenue
        app.prisma.order.aggregate({
          where: { ...storeFilter, createdAt: { gte: previousStart, lt: periodStart } },
          _sum: { totalAmount: true },
        }),
        // Unique customers, both periods
        customerCounts(app.prisma, scope, periodStart, previousStart),
      ]);

      const currentRevenue = currentRevenueAgg._sum.totalAmount?.toNumber() ?? 0;
      const previousRevenue = previousRevenueAgg._sum.totalAmount?.toNumber() ?? 0;
      const currentAOV = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;
      const previousAOV = previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0;

      const kpis: KPIs = {
        totalRevenue: currentRevenue,
        previousRevenue,
        totalOrders: currentOrderCount,
        previousOrders: previousOrderCount,
        averageOrderValue: Math.round(currentAOV * 100) / 100,
        previousAOV: Math.round(previousAOV * 100) / 100,
        totalCustomers: customers.current,
        previousCustomers: customers.previous,
      };

      // ── Time Series ──────────────────────────────────────
      const daily = await dailyTotals(app.prisma, scope, periodStart, todayKey, days);
      const revenueOverTime = daily.map(({ date, revenue }) => ({ date, revenue }));
      const ordersOverTime = daily.map(({ date, count }) => ({ date, count }));

      // ── Breakdowns ───────────────────────────────────────
      const [statusBreakdown, paymentBreakdown, fulfillmentBreakdown] = await Promise.all([
        // Orders by status (current period)
        app.prisma.order.groupBy({
          by: ["status"],
          where: { ...storeFilter, createdAt: { gte: periodStart } },
          _count: { id: true },
        }),
        // Revenue by payment method (current period)
        app.prisma.order.groupBy({
          by: ["paymentMethod"],
          where: { ...storeFilter, createdAt: { gte: periodStart } },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        // Orders by fulfillment type (current period)
        app.prisma.order.groupBy({
          by: ["fulfillmentType"],
          where: { ...storeFilter, createdAt: { gte: periodStart } },
          _count: { id: true },
        }),
      ]);

      const ordersByStatus = statusBreakdown.map((row) => ({
        status: row.status,
        count: row._count.id,
      }));

      const revenueByPaymentMethod = paymentBreakdown.map((row) => ({
        method: row.paymentMethod,
        revenue: row._sum.totalAmount?.toNumber() ?? 0,
        count: row._count.id,
      }));

      const ordersByFulfillment = fulfillmentBreakdown.map((row) => ({
        type: row.fulfillmentType,
        count: row._count.id,
      }));

      // ── Top Products (DELIVERED orders only) ─────────────
      const topProductRows = await app.prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            ...storeFilter,
            status: "DELIVERED",
            createdAt: { gte: periodStart },
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      });

      let topProducts: { name: string; quantity: number; revenue: number }[] = [];
      if (topProductRows.length > 0) {
        const productIds = topProductRows.map((r) => r.productId);
        const products = await app.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p.name]));
        topProducts = topProductRows.map((row) => ({
          name: productMap.get(row.productId) ?? "Unknown",
          quantity: row._sum.quantity ?? 0,
          revenue: row._sum.totalPrice?.toNumber() ?? 0,
        }));
      }

      // ── Recent Orders ────────────────────────────────────
      const recentOrderRows = await app.prisma.order.findMany({
        where: storeFilter,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          paymentMethod: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      });

      const recentOrders = recentOrderRows.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount.toNumber(),
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt.toISOString(),
        customerName: o.user.name ?? o.user.email,
      }));

      // ── Response ─────────────────────────────────────────
      const data: DashboardData = {
        kpis,
        revenueOverTime,
        ordersOverTime,
        ordersByStatus,
        revenueByPaymentMethod,
        ordersByFulfillment,
        topProducts,
        recentOrders,
      };

      const response: ApiResponse<DashboardData> = { success: true, data };
      return response;
    },
  );
}
