import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";

// ── Rate Limiter ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ── Route registration ──────────────────────────────
export async function customerInsightsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")];
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── 1. Ask Your Store (AI Analytics Q&A) ──────────
  app.post("/ask", { preHandler }, async (request, reply) => {
    const user = request.user as { sub: string };
    if (!checkRateLimit(user.sub)) {
      return reply.tooManyRequests("Too many requests. Please wait a moment.");
    }

    const { storeId, question } = request.body as { storeId?: string; question?: string };
    if (!storeId || !question) return reply.badRequest("storeId and question are required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    // Gather store context in parallel (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [currentMetrics, previousMetrics, topProducts, statusBreakdown, paymentBreakdown, storeRatingData] =
      await Promise.all([
        // Current 30 days
        app.prisma.$queryRaw<
          Array<{ revenue: number; order_count: bigint; customer_count: bigint }>
        >`
          SELECT
            COALESCE(SUM(total_amount), 0)::float AS revenue,
            COUNT(*) AS order_count,
            COUNT(DISTINCT user_id) AS customer_count
          FROM orders
          WHERE store_id = ${storeId}
            AND status = 'DELIVERED'
            AND created_at >= ${thirtyDaysAgo}
        `,
        // Previous 30 days (for % change)
        app.prisma.$queryRaw<
          Array<{ revenue: number; order_count: bigint; customer_count: bigint }>
        >`
          SELECT
            COALESCE(SUM(total_amount), 0)::float AS revenue,
            COUNT(*) AS order_count,
            COUNT(DISTINCT user_id) AS customer_count
          FROM orders
          WHERE store_id = ${storeId}
            AND status = 'DELIVERED'
            AND created_at >= ${sixtyDaysAgo}
            AND created_at < ${thirtyDaysAgo}
        `,
        // Top 5 products by quantity
        app.prisma.$queryRaw<
          Array<{ product_name: string; total_qty: bigint }>
        >`
          SELECT p.name AS product_name, SUM(oi.quantity) AS total_qty
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN store_products sp ON sp.id = oi.store_product_id
          JOIN products p ON p.id = sp.product_id
          WHERE o.store_id = ${storeId}
            AND o.status = 'DELIVERED'
            AND o.created_at >= ${thirtyDaysAgo}
          GROUP BY p.name
          ORDER BY total_qty DESC
          LIMIT 5
        `,
        // Orders by status
        app.prisma.$queryRaw<
          Array<{ status: string; count: bigint }>
        >`
          SELECT status, COUNT(*) AS count
          FROM orders
          WHERE store_id = ${storeId}
            AND created_at >= ${thirtyDaysAgo}
          GROUP BY status
        `,
        // Payment method breakdown
        app.prisma.$queryRaw<
          Array<{ payment_method: string; count: bigint }>
        >`
          SELECT payment_method, COUNT(*) AS count
          FROM orders
          WHERE store_id = ${storeId}
            AND status = 'DELIVERED'
            AND created_at >= ${thirtyDaysAgo}
          GROUP BY payment_method
        `,
        // Store ratings
        app.prisma.storeRating.aggregate({
          where: { storeId, createdAt: { gte: thirtyDaysAgo } },
          _avg: { overallRating: true },
          _count: true,
        }),
      ]);

    const curr = currentMetrics[0];
    const prev = previousMetrics[0];
    const revenue = curr.revenue;
    const orderCount = Number(curr.order_count);
    const customerCount = Number(curr.customer_count);
    const aov = orderCount > 0 ? revenue / orderCount : 0;

    const prevRevenue = prev.revenue;
    const prevOrderCount = Number(prev.order_count);
    const prevCustomerCount = Number(prev.customer_count);

    const pctChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const context = {
      revenue: Math.round(revenue),
      revenueChange: pctChange(revenue, prevRevenue),
      orderCount,
      orderChange: pctChange(orderCount, prevOrderCount),
      customerCount,
      customerChange: pctChange(customerCount, prevCustomerCount),
      aov: Math.round(aov),
      topProducts: topProducts.map((p) => ({ name: p.product_name, qty: Number(p.total_qty) })),
      statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: Number(s.count) })),
      paymentBreakdown: paymentBreakdown.map((p) => ({ method: p.payment_method, count: Number(p.count) })),
      avgStoreRating: storeRatingData._avg?.overallRating ? Number(storeRatingData._avg.overallRating.toFixed(1)) : null,
      storeRatingCount: storeRatingData._count,
    };

    const systemPrompt = `You are an analytics assistant for a grocery store owner. Answer their question based on the store data below.

Return ONLY valid JSON (no markdown, no code fences). Use this exact structure:
{
  "headline": "1-sentence answer/summary",
  "highlights": [
    { "label": "Metric Name", "value": "formatted value with \u20B9 for currency", "change": "+X%" or "-X%" or null, "direction": "up" or "down" or "neutral" }
  ],
  "insights": [
    { "label": "Short Label", "detail": "1-sentence insight" }
  ],
  "tip": "One actionable recommendation based on the data"
}

Rules:
- highlights: 2-4 most relevant metrics as cards. Use \u20B9 for currency. Include change% when available.
- insights: 2-5 key observations. Each has a short label and a detail sentence.
- tip: One specific, actionable suggestion. Skip generic advice.
- Pick metrics and insights most relevant to the question asked. Don't just dump all data.

Store Data (Last 30 Days):
- Revenue: \u20B9${context.revenue.toLocaleString("en-IN")} (${context.revenueChange >= 0 ? "+" : ""}${context.revenueChange}% vs previous 30 days)
- Orders: ${context.orderCount} (${context.orderChange >= 0 ? "+" : ""}${context.orderChange}% vs previous)
- Unique customers: ${context.customerCount} (${context.customerChange >= 0 ? "+" : ""}${context.customerChange}% vs previous)
- Average order value: \u20B9${context.aov}
- Top products: ${context.topProducts.map((p) => `${p.name} (${p.qty} sold)`).join(", ") || "None"}
- Order status breakdown: ${context.statusBreakdown.map((s) => `${s.status}: ${s.count}`).join(", ") || "None"}
- Payment methods: ${context.paymentBreakdown.map((p) => `${p.method}: ${p.count}`).join(", ") || "None"}
- Store rating: ${context.avgStoreRating ?? "No ratings"} (${context.storeRatingCount} ratings)`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    return {
      success: true,
      data: {
        headline: (parsed.headline as string) ?? "Here's what I found.",
        highlights: (parsed.highlights as Array<{ label: string; value: string; change: string | null; direction: string }>) ?? [],
        insights: (parsed.insights as Array<{ label: string; detail: string }>) ?? [],
        tip: (parsed.tip as string) ?? null,
        context: {
          revenue: context.revenue,
          revenueChange: context.revenueChange,
          orderCount: context.orderCount,
          orderChange: context.orderChange,
          customerCount: context.customerCount,
          customerChange: context.customerChange,
          aov: context.aov,
          topProducts: context.topProducts,
        },
      },
    };
  });

  // ── 2. Churn Risk ─────────────────────────────────
  app.get("/churn-risk", { preHandler }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    const rows = await app.prisma.$queryRaw<
      Array<{
        user_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        order_count: bigint;
        total_spent: number;
        avg_order_value: number;
        last_order_date: Date;
        first_order_date: Date;
      }>
    >`
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0)::float AS total_spent,
        COALESCE(AVG(o.total_amount), 0)::float AS avg_order_value,
        MAX(o.created_at) AS last_order_date,
        MIN(o.created_at) AS first_order_date
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.store_id = ${storeId}
        AND o.status != 'CANCELLED'
      GROUP BY u.id, u.name, u.email, u.phone
    `;

    const now = new Date();
    const SUGGESTED_ACTIONS: Record<string, string> = {
      active: "Keep engaging with personalized recommendations",
      at_risk: "Send a personalized offer with their favorite products",
      churning: "Send a win-back coupon (10-15% off) with limited-time expiry",
      churned: "Send a 'We miss you' message with aggressive discount or free delivery",
    };

    const customers = rows.map((r) => {
      const daysSinceLastOrder = Math.floor((now.getTime() - r.last_order_date.getTime()) / (1000 * 60 * 60 * 24));
      let riskLevel: "active" | "at_risk" | "churning" | "churned";
      if (daysSinceLastOrder < 14) riskLevel = "active";
      else if (daysSinceLastOrder <= 30) riskLevel = "at_risk";
      else if (daysSinceLastOrder <= 60) riskLevel = "churning";
      else riskLevel = "churned";

      return {
        id: r.user_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        totalOrders: Number(r.order_count),
        totalSpent: Math.round(r.total_spent),
        avgOrderValue: Math.round(r.avg_order_value),
        lastOrderDate: r.last_order_date.toISOString(),
        firstOrderDate: r.first_order_date.toISOString(),
        daysSinceLastOrder,
        riskLevel,
        suggestedAction: SUGGESTED_ACTIONS[riskLevel],
      };
    });

    // Sort by daysSinceLastOrder DESC (churned first)
    customers.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

    const summary = {
      totalCustomers: customers.length,
      active: customers.filter((c) => c.riskLevel === "active").length,
      atRisk: customers.filter((c) => c.riskLevel === "at_risk").length,
      churning: customers.filter((c) => c.riskLevel === "churning").length,
      churned: customers.filter((c) => c.riskLevel === "churned").length,
    };

    return { success: true, data: { summary, customers } };
  });

  // ── 3. Review Summary (AI) ────────────────────────
  app.get("/review-summary", { preHandler }, async (request, reply) => {
    const { storeId, days = "90" } = request.query as { storeId?: string; days?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    const periodDays = Math.min(Math.max(Number(days) || 90, 7), 365);
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const [productReviews, storeRatings] = await Promise.all([
      app.prisma.review.findMany({
        where: {
          storeId,
          status: "APPROVED",
          createdAt: { gte: since },
        },
        select: { rating: true, comment: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
      app.prisma.storeRating.findMany({
        where: { storeId, createdAt: { gte: since } },
        select: { overallRating: true, comment: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const reviewCount = productReviews.length;
    const storeRatingCount = storeRatings.length;

    if (reviewCount === 0 && storeRatingCount === 0) {
      return {
        success: true,
        data: {
          overallSentiment: null,
          summary: "No reviews or ratings found for this period.",
          positives: [],
          negatives: [],
          patterns: [],
          recommendations: [],
          meta: { reviewCount: 0, storeRatingCount: 0, avgProductRating: null, avgStoreRating: null, periodDays },
        },
      };
    }

    const avgProductRating =
      reviewCount > 0
        ? Math.round((productReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
        : null;
    const avgStoreRating =
      storeRatingCount > 0
        ? Math.round((storeRatings.reduce((sum, r) => sum + r.overallRating, 0) / storeRatingCount) * 10) / 10
        : null;

    // Collect all comments for AI
    const allComments = [
      ...productReviews.filter((r) => r.comment).map((r) => `[Product Review, ${r.rating}/5]: ${r.comment}`),
      ...storeRatings.filter((r) => r.comment).map((r) => `[Store Rating, ${r.overallRating}/5]: ${r.comment}`),
    ];

    if (allComments.length === 0) {
      return {
        success: true,
        data: {
          overallSentiment: avgProductRating && avgProductRating >= 3.5 ? "positive" : avgProductRating && avgProductRating >= 2.5 ? "mixed" : "negative",
          summary: `${reviewCount} product reviews and ${storeRatingCount} store ratings found, but none have written comments to analyze.`,
          positives: [],
          negatives: [],
          patterns: [],
          recommendations: [],
          meta: { reviewCount, storeRatingCount, avgProductRating, avgStoreRating, periodDays },
        },
      };
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "You are a review analysis assistant for a grocery store. Analyze customer reviews and return structured insights as JSON only.",
      messages: [
        {
          role: "user",
          content: `Analyze these ${allComments.length} customer reviews and return ONLY valid JSON (no markdown, no code fences):
{
  "overallSentiment": "positive" or "mixed" or "negative",
  "summary": "2-3 sentence summary of overall customer sentiment",
  "positives": ["positive theme 1", "positive theme 2"],
  "negatives": ["negative theme 1", "negative theme 2"],
  "patterns": ["recurring pattern 1", "recurring pattern 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"]
}

Reviews:
${allComments.join("\n")}`,
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    return {
      success: true,
      data: {
        overallSentiment: (parsed.overallSentiment as string) ?? "mixed",
        summary: (parsed.summary as string) ?? "Unable to generate summary.",
        positives: (parsed.positives as string[]) ?? [],
        negatives: (parsed.negatives as string[]) ?? [],
        patterns: (parsed.patterns as string[]) ?? [],
        recommendations: (parsed.recommendations as string[]) ?? [],
        meta: { reviewCount, storeRatingCount, avgProductRating, avgStoreRating, periodDays },
      },
    };
  });
}
