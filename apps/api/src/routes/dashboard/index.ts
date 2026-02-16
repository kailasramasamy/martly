import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgStoreIds } from "../../middleware/org-scope.js";

interface DayData {
  date: string;
  count: number;
  revenue: number;
}

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  activeStores: number;
  totalProducts: number;
  ordersOverTime: DayData[];
  revenueOverTime: DayData[];
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/stats",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // Scope queries by org's stores
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      const storeFilter = orgStoreIds !== undefined ? { storeId: { in: orgStoreIds } } : {};
      const storeIdFilter = orgStoreIds !== undefined ? { id: { in: orgStoreIds } } : {};

      const [totalOrders, revenueResult, activeStores, totalProducts, recentOrders] =
        await Promise.all([
          app.prisma.order.count({ where: storeFilter }),
          app.prisma.order.aggregate({ where: storeFilter, _sum: { totalAmount: true } }),
          app.prisma.store.count({ where: { ...storeIdFilter, status: "ACTIVE" } }),
          app.prisma.product.count(), // global shared catalog
          app.prisma.order.findMany({
            where: { ...storeFilter, createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true, totalAmount: true },
            orderBy: { createdAt: "asc" },
          }),
        ]);

      const dayMap = new Map<string, { count: number; revenue: number }>();

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, { count: 0, revenue: 0 });
      }

      for (const order of recentOrders) {
        const key = order.createdAt.toISOString().slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) {
          entry.count += 1;
          entry.revenue += order.totalAmount.toNumber();
        }
      }

      const ordersOverTime: DayData[] = [];
      const revenueOverTime: DayData[] = [];

      for (const [date, data] of dayMap) {
        ordersOverTime.push({ date, count: data.count, revenue: data.revenue });
        revenueOverTime.push({ date, count: data.count, revenue: data.revenue });
      }

      const stats: DashboardStats = {
        totalOrders,
        totalRevenue: revenueResult._sum.totalAmount?.toNumber() ?? 0,
        activeStores,
        totalProducts,
        ordersOverTime,
        revenueOverTime,
      };

      const response: ApiResponse<DashboardStats> = { success: true, data: stats };
      return response;
    },
  );
}
