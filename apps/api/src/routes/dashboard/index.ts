import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgStoreIds } from "../../middleware/org-scope.js";

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
  app.get(
    "/stats",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const { days: daysParam } = request.query as { days?: string };
      const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 7;

      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      periodStart.setHours(0, 0, 0, 0);

      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      // Org scoping
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      const storeFilter = orgStoreIds !== undefined ? { storeId: { in: orgStoreIds } } : {};

      // ── KPIs: Current Period ─────────────────────────────
      const [
        currentOrderCount,
        currentRevenueAgg,
        currentCustomerCount,
        previousOrderCount,
        previousRevenueAgg,
        previousCustomerCount,
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
        // Current period unique customers
        app.prisma.order.findMany({
          where: { ...storeFilter, createdAt: { gte: periodStart } },
          select: { userId: true },
          distinct: ["userId"],
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
        // Previous period unique customers
        app.prisma.order.findMany({
          where: { ...storeFilter, createdAt: { gte: previousStart, lt: periodStart } },
          select: { userId: true },
          distinct: ["userId"],
        }),
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
        totalCustomers: currentCustomerCount.length,
        previousCustomers: previousCustomerCount.length,
      };

      // ── Time Series ──────────────────────────────────────
      const periodOrders = await app.prisma.order.findMany({
        where: { ...storeFilter, createdAt: { gte: periodStart } },
        select: { createdAt: true, totalAmount: true },
        orderBy: { createdAt: "asc" },
      });

      const dayMap = new Map<string, { count: number; revenue: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap.set(d.toISOString().slice(0, 10), { count: 0, revenue: 0 });
      }
      for (const order of periodOrders) {
        const key = order.createdAt.toISOString().slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) {
          entry.count += 1;
          entry.revenue += order.totalAmount.toNumber();
        }
      }

      const revenueOverTime: { date: string; revenue: number }[] = [];
      const ordersOverTime: { date: string; count: number }[] = [];
      for (const [date, data] of dayMap) {
        revenueOverTime.push({ date, revenue: Math.round(data.revenue * 100) / 100 });
        ordersOverTime.push({ date, count: data.count });
      }

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
