import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";

// ── Shared demand calculation ───────────────────────
interface DemandRow {
  storeProductId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  currentStock: number;
  avgDailyDemand: number;
  daysOfStockLeft: number;
  totalQuantitySold: number;
  totalOrders: number;
  lastOrderDate: string;
}

async function computeDemand(
  prisma: FastifyInstance["prisma"],
  storeId: string,
  days: number,
): Promise<DemandRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.$queryRaw<
    Array<{
      store_product_id: string;
      product_name: string;
      variant_name: string;
      image_url: string | null;
      current_stock: number;
      total_quantity: bigint;
      total_orders: bigint;
      distinct_days: bigint;
      last_order_date: Date;
    }>
  >`
    SELECT
      sp.id AS store_product_id,
      p.name AS product_name,
      pv.name AS variant_name,
      COALESCE(p.image_url, pv.image_url) AS image_url,
      (sp.stock - sp.reserved_stock) AS current_stock,
      SUM(oi.quantity) AS total_quantity,
      COUNT(DISTINCT oi.order_id) AS total_orders,
      COUNT(DISTINCT DATE(o.created_at)) AS distinct_days,
      MAX(o.created_at) AS last_order_date
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN store_products sp ON sp.id = oi.store_product_id
    JOIN products p ON p.id = sp.product_id
    JOIN product_variants pv ON pv.id = sp.variant_id
    WHERE o.store_id = ${storeId}
      AND o.status = 'DELIVERED'
      AND o.created_at >= ${since}
    GROUP BY sp.id, p.name, pv.name, p.image_url, pv.image_url, sp.stock, sp.reserved_stock
    ORDER BY total_quantity DESC
  `;

  return rows.map((r) => {
    const distinctDays = Number(r.distinct_days) || 1;
    const totalQty = Number(r.total_quantity);
    const avgDaily = totalQty / distinctDays;
    const availableStock = Math.max(r.current_stock, 0);
    const daysLeft = avgDaily > 0 ? availableStock / avgDaily : Infinity;

    return {
      storeProductId: r.store_product_id,
      productName: r.product_name,
      variantName: r.variant_name,
      imageUrl: r.image_url,
      currentStock: r.current_stock,
      avgDailyDemand: Math.round(avgDaily * 100) / 100,
      daysOfStockLeft: daysLeft === Infinity ? -1 : Math.round(daysLeft * 10) / 10,
      totalQuantitySold: totalQty,
      totalOrders: Number(r.total_orders),
      lastOrderDate: r.last_order_date.toISOString(),
    };
  });
}

// ── Route registration ──────────────────────────────
export async function storeIntelligenceRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")];

  // ── 1. Demand Forecast ────────────────────────────
  app.get("/demand-forecast", { preHandler }, async (request, reply) => {
    const { storeId, days = "30" } = request.query as { storeId?: string; days?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    const periodDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const data = await computeDemand(app.prisma, storeId, periodDays);

    // Sort by daysOfStockLeft ASC (most urgent first), -1 (no demand) goes last
    data.sort((a, b) => {
      if (a.daysOfStockLeft === -1 && b.daysOfStockLeft === -1) return 0;
      if (a.daysOfStockLeft === -1) return 1;
      if (b.daysOfStockLeft === -1) return -1;
      return a.daysOfStockLeft - b.daysOfStockLeft;
    });

    return {
      success: true,
      data,
      meta: { storeId, periodDays, totalProducts: data.length },
    };
  });

  // ── 2. Reorder Suggestions ────────────────────────
  app.get("/reorder-suggestions", { preHandler }, async (request, reply) => {
    const { storeId, threshold = "7" } = request.query as { storeId?: string; threshold?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    const thresholdDays = Math.min(Math.max(Number(threshold) || 7, 1), 60);
    const demand = await computeDemand(app.prisma, storeId, 30);

    const suggestions = demand
      .filter((d) => d.daysOfStockLeft >= 0 && d.daysOfStockLeft <= thresholdDays)
      .map((d) => {
        let urgency: "critical" | "warning" | "info";
        if (d.daysOfStockLeft <= 2) urgency = "critical";
        else if (d.daysOfStockLeft <= 5) urgency = "warning";
        else urgency = "info";

        return {
          ...d,
          suggestedReorderQty: Math.ceil(d.avgDailyDemand * 14),
          urgency,
        };
      })
      .sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);

    const criticalCount = suggestions.filter((s) => s.urgency === "critical").length;
    const warningCount = suggestions.filter((s) => s.urgency === "warning").length;

    return {
      success: true,
      data: suggestions,
      meta: { storeId, threshold: thresholdDays, criticalCount, warningCount },
    };
  });

  // ── 3. Anomalies ──────────────────────────────────
  app.get("/anomalies", { preHandler }, async (request, reply) => {
    const { storeId, days = "30" } = request.query as { storeId?: string; days?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const hasAccess = await verifyStoreOrgAccess(request, app.prisma, storeId);
    if (!hasAccess) return reply.forbidden("No access to this store");

    const periodDays = Math.min(Math.max(Number(days) || 30, 7), 365);

    interface Anomaly {
      type: "demand_spike" | "demand_drop" | "stock_mismatch" | "dead_stock";
      severity: "high" | "medium" | "low";
      storeProductId: string;
      productName: string;
      variantName: string;
      message: string;
      details: Record<string, unknown>;
    }

    const anomalies: Anomaly[] = [];

    // ── Demand spikes & drops ──
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);

    const demandComparison = await app.prisma.$queryRaw<
      Array<{
        store_product_id: string;
        product_name: string;
        variant_name: string;
        total_qty_period: bigint;
        total_qty_7d: bigint;
        period_days: number;
      }>
    >`
      SELECT
        sp.id AS store_product_id,
        p.name AS product_name,
        pv.name AS variant_name,
        COALESCE(SUM(oi.quantity), 0) AS total_qty_period,
        COALESCE(SUM(CASE WHEN o.created_at >= ${sevenDaysAgo} THEN oi.quantity ELSE 0 END), 0) AS total_qty_7d,
        ${periodDays} AS period_days
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN store_products sp ON sp.id = oi.store_product_id
      JOIN products p ON p.id = sp.product_id
      JOIN product_variants pv ON pv.id = sp.variant_id
      WHERE o.store_id = ${storeId}
        AND o.status = 'DELIVERED'
        AND o.created_at >= ${periodStart}
      GROUP BY sp.id, p.name, pv.name
      HAVING COALESCE(SUM(oi.quantity), 0) > 0
    `;

    for (const row of demandComparison) {
      const totalPeriod = Number(row.total_qty_period);
      const total7d = Number(row.total_qty_7d);
      if (totalPeriod === 0) continue;

      const avgDailyPeriod = totalPeriod / periodDays;
      const avgDaily7d = total7d / 7;

      // Skip products with negligible demand (< 0.3/day over the period) to avoid noise
      if (avgDailyPeriod >= 0.3) {
        const ratio = avgDaily7d / avgDailyPeriod;

        if (ratio > 2) {
          anomalies.push({
            type: "demand_spike",
            severity: ratio > 4 ? "high" : "medium",
            storeProductId: row.store_product_id,
            productName: row.product_name,
            variantName: row.variant_name,
            message: `${row.product_name} demand spiked ${ratio.toFixed(1)}x in last 7 days`,
            details: { ratio: Math.round(ratio * 10) / 10, avgDaily7d: Math.round(avgDaily7d * 10) / 10, avgDailyPeriod: Math.round(avgDailyPeriod * 10) / 10 },
          });
        } else if (ratio < 0.5) {
          anomalies.push({
            type: "demand_drop",
            severity: ratio < 0.2 ? "high" : "medium",
            storeProductId: row.store_product_id,
            productName: row.product_name,
            variantName: row.variant_name,
            message: `${row.product_name} demand dropped to ${(ratio * 100).toFixed(0)}% of normal`,
            details: { ratio: Math.round(ratio * 100) / 100, avgDaily7d: Math.round(avgDaily7d * 10) / 10, avgDailyPeriod: Math.round(avgDailyPeriod * 10) / 10 },
          });
        }
      }
    }

    // ── Stock mismatches ──
    const stockIssues = await app.prisma.storeProduct.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { stock: { lt: 0 } },
          // reservedStock > stock
        ],
      },
      include: {
        product: { select: { name: true } },
        variant: { select: { name: true } },
      },
    });

    // Also find reservedStock > stock
    const reservedIssues = await app.prisma.$queryRaw<
      Array<{
        id: string;
        product_name: string;
        variant_name: string;
        stock: number;
        reserved_stock: number;
      }>
    >`
      SELECT sp.id, p.name AS product_name, pv.name AS variant_name,
             sp.stock, sp.reserved_stock
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN product_variants pv ON pv.id = sp.variant_id
      WHERE sp.store_id = ${storeId}
        AND sp.is_active = true
        AND sp.reserved_stock > sp.stock
    `;

    for (const sp of stockIssues) {
      if (sp.stock < 0) {
        anomalies.push({
          type: "stock_mismatch",
          severity: "high",
          storeProductId: sp.id,
          productName: sp.product.name,
          variantName: sp.variant.name,
          message: `${sp.product.name} has negative stock (${sp.stock})`,
          details: { stock: sp.stock, reservedStock: sp.reservedStock },
        });
      }
    }

    for (const ri of reservedIssues) {
      // Skip if already reported as negative stock
      if (anomalies.some((a) => a.storeProductId === ri.id && a.type === "stock_mismatch")) continue;
      anomalies.push({
        type: "stock_mismatch",
        severity: "medium",
        storeProductId: ri.id,
        productName: ri.product_name,
        variantName: ri.variant_name,
        message: `${ri.product_name} reserved stock (${ri.reserved_stock}) exceeds total stock (${ri.stock})`,
        details: { stock: ri.stock, reservedStock: ri.reserved_stock },
      });
    }

    // ── Dead stock ──
    const deadStock = await app.prisma.$queryRaw<
      Array<{
        id: string;
        product_name: string;
        variant_name: string;
        stock: number;
      }>
    >`
      SELECT sp.id, p.name AS product_name, pv.name AS variant_name,
             (sp.stock - sp.reserved_stock) AS stock
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN product_variants pv ON pv.id = sp.variant_id
      LEFT JOIN (
        SELECT oi.store_product_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.store_id = ${storeId}
          AND o.status = 'DELIVERED'
          AND o.created_at >= ${periodStart}
        GROUP BY oi.store_product_id
      ) recent_orders ON recent_orders.store_product_id = sp.id
      WHERE sp.store_id = ${storeId}
        AND sp.is_active = true
        AND (sp.stock - sp.reserved_stock) > 0
        AND recent_orders.store_product_id IS NULL
    `;

    for (const ds of deadStock) {
      anomalies.push({
        type: "dead_stock",
        severity: ds.stock > 50 ? "high" : ds.stock > 10 ? "medium" : "low",
        storeProductId: ds.id,
        productName: ds.product_name,
        variantName: ds.variant_name,
        message: `${ds.product_name} has ${ds.stock} units in stock but zero orders in ${periodDays} days`,
        details: { availableStock: ds.stock, daysSinceLastOrder: periodDays },
      });
    }

    // Sort: high severity first
    const severityOrder = { high: 0, medium: 1, low: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const highCount = anomalies.filter((a) => a.severity === "high").length;

    return {
      success: true,
      data: anomalies,
      meta: { storeId, periodDays, totalAnomalies: anomalies.length, highCount },
    };
  });

  // ── 4. AI Product Description Generator ───────────
  app.post("/generate-description", { preHandler }, async (request, reply) => {
    const { imageUrl } = request.body as { imageUrl?: string };
    if (!imageUrl) return reply.badRequest("imageUrl is required");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: `Analyze this product image for an Indian grocery store catalog. Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "product name",
  "brand": "brand name or null",
  "description": "1-2 sentence description",
  "suggestedCategory": "one of: Fruits & Vegetables, Dairy, Snacks, Beverages, Staples, Personal Care, Household, Bakery",
  "foodType": "VEG or NON_VEG or VEGAN or null based on markings",
  "estimatedWeight": "weight if visible on packaging or null"
}`,
            },
          ],
        },
      ],
      system: "You are a product cataloging assistant for an Indian grocery store. Analyze product images and return structured data as JSON only.",
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
        name: (parsed.name as string) ?? "Unknown Product",
        brand: (parsed.brand as string) ?? null,
        description: (parsed.description as string) ?? "",
        suggestedCategory: (parsed.suggestedCategory as string) ?? "Staples",
        foodType: (parsed.foodType as string) ?? null,
        estimatedWeight: (parsed.estimatedWeight as string) ?? null,
      },
    };
  });
}
