import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

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
    async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const [totalOrders, revenueResult, activeStores, totalProducts, recentOrders] =
        await Promise.all([
          app.prisma.order.count(),
          app.prisma.order.aggregate({ _sum: { totalAmount: true } }),
          app.prisma.store.count({ where: { status: "ACTIVE" } }),
          app.prisma.product.count(),
          app.prisma.order.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true, totalAmount: true },
            orderBy: { createdAt: "asc" },
          }),
        ]);

      // Group recent orders by date
      const dayMap = new Map<string, { count: number; revenue: number }>();

      // Pre-fill all 7 days so chart has no gaps
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
