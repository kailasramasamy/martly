import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgStoreIds } from "../../middleware/org-scope.js";

export async function reviewAnalyticsRoutes(app: FastifyInstance) {
  // GET /?days=30 - Review analytics dashboard data
  app.get("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request) => {
    const { days = 30 } = request.query as { days?: number };
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const storeIds = await getOrgStoreIds(request, app.prisma);
    const storeFilter: Record<string, unknown> = storeIds ? { storeId: { in: storeIds } } : {};

    // KPIs
    const [totalReviews, avgRatingResult, pendingCount, repliedCount, recentReviews] = await Promise.all([
      app.prisma.review.count({ where: { ...storeFilter, createdAt: { gte: since } } }),
      app.prisma.review.aggregate({
        where: { ...storeFilter, status: "APPROVED" },
        _avg: { rating: true },
      }),
      app.prisma.review.count({ where: { ...storeFilter, status: "PENDING" } }),
      app.prisma.reviewReply.count({
        where: { review: { ...storeFilter, createdAt: { gte: since } } },
      }),
      app.prisma.review.findMany({
        where: { ...storeFilter, createdAt: { gte: since } },
        select: { rating: true, createdAt: true },
      }),
    ]);

    const avgRating = avgRatingResult._avg.rating ? Math.round(avgRatingResult._avg.rating * 10) / 10 : 0;
    const responseRate = totalReviews > 0 ? Math.round((repliedCount / totalReviews) * 100) : 0;

    // Rating distribution (all time, approved only)
    const allApproved = await app.prisma.review.findMany({
      where: { ...storeFilter, status: "APPROVED" },
      select: { rating: true },
    });
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allApproved) distribution[r.rating]++;

    // Review volume over time (group by date)
    const volumeMap: Record<string, number> = {};
    for (const r of recentReviews) {
      const dateKey = r.createdAt.toISOString().split("T")[0];
      volumeMap[dateKey] = (volumeMap[dateKey] || 0) + 1;
    }
    const volume = Object.entries(volumeMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Top 10 products by avg rating (min 2 reviews)
    const productRatings = await app.prisma.review.groupBy({
      by: ["productId"],
      where: { ...storeFilter, status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
      orderBy: { _avg: { rating: "desc" } },
      take: 10,
    });

    const topProductIds = productRatings.map((p) => p.productId);
    const topProducts = topProductIds.length > 0
      ? await app.prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
    const productMap = new Map(topProducts.map((p) => [p.id, p]));

    const topRated = productRatings.map((p) => ({
      productId: p.productId,
      name: productMap.get(p.productId)?.name ?? "Unknown",
      imageUrl: productMap.get(p.productId)?.imageUrl ?? null,
      avgRating: Math.round((p._avg.rating ?? 0) * 10) / 10,
      reviewCount: p._count.id,
    }));

    // Bottom 10 products by avg rating (min 2 reviews)
    const worstRatings = await app.prisma.review.groupBy({
      by: ["productId"],
      where: { ...storeFilter, status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
      orderBy: { _avg: { rating: "asc" } },
      take: 10,
    });

    const worstProductIds = worstRatings.map((p) => p.productId);
    const worstProducts = worstProductIds.length > 0
      ? await app.prisma.product.findMany({
          where: { id: { in: worstProductIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
    const worstMap = new Map(worstProducts.map((p) => [p.id, p]));

    const worstRated = worstRatings.map((p) => ({
      productId: p.productId,
      name: worstMap.get(p.productId)?.name ?? "Unknown",
      imageUrl: worstMap.get(p.productId)?.imageUrl ?? null,
      avgRating: Math.round((p._avg.rating ?? 0) * 10) / 10,
      reviewCount: p._count.id,
    }));

    // Store rating summary
    const storeRatingAgg = await app.prisma.storeRating.aggregate({
      where: storeIds ? { storeId: { in: storeIds } } : {},
      _avg: { overallRating: true, deliveryRating: true, packagingRating: true },
      _count: { id: true },
    });

    const storeRatingSummary = {
      count: storeRatingAgg._count.id,
      overall: Math.round((storeRatingAgg._avg.overallRating ?? 0) * 10) / 10,
      delivery: Math.round((storeRatingAgg._avg.deliveryRating ?? 0) * 10) / 10,
      packaging: Math.round((storeRatingAgg._avg.packagingRating ?? 0) * 10) / 10,
    };

    const response: ApiResponse<{
      kpis: { totalReviews: number; avgRating: number; pendingModeration: number; responseRate: number };
      distribution: Record<number, number>;
      volume: { date: string; count: number }[];
      topRated: typeof topRated;
      worstRated: typeof worstRated;
      storeRatingSummary: typeof storeRatingSummary;
    }> = {
      success: true,
      data: {
        kpis: { totalReviews, avgRating, pendingModeration: pendingCount, responseRate },
        distribution,
        volume,
        topRated,
        worstRated,
        storeRatingSummary,
      },
    };
    return response;
  });
}
