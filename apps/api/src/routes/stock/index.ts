import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgStoreIds, getOrgUser } from "../../middleware/org-scope.js";

const LOW_STOCK_THRESHOLD = 5;

interface StoreSummary {
  storeId: string;
  storeName: string;
  totalSKUs: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

interface RecentChange {
  storeProductId: string;
  productName: string;
  storeName: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  updatedAt: string;
}

interface StockSummary {
  totals: { totalSKUs: number; inStock: number; lowStock: number; outOfStock: number };
  byStore: StoreSummary[];
  recentChanges: RecentChange[];
}

export async function stockRoutes(app: FastifyInstance) {
  app.get(
    "/summary",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const { storeId, organizationId } = request.query as {
        storeId?: string;
        organizationId?: string;
      };

      const user = getOrgUser(request);

      // Scope to org's stores
      let orgStoreIds = await getOrgStoreIds(request, app.prisma);

      // SUPER_ADMIN: optionally filter by organizationId
      if (user.role === "SUPER_ADMIN" && organizationId) {
        const orgStores = await app.prisma.store.findMany({
          where: { organizationId },
          select: { id: true },
        });
        orgStoreIds = orgStores.map((s: { id: string }) => s.id);
      }

      // Narrow to specific store if provided
      const storeFilter: Record<string, unknown> = {};
      if (storeId) {
        storeFilter.storeId = storeId;
      } else if (orgStoreIds !== undefined) {
        storeFilter.storeId = { in: orgStoreIds };
      }

      // Fetch all store-products within scope with store and product info
      const storeProducts = await app.prisma.storeProduct.findMany({
        where: storeFilter,
        include: {
          store: { select: { id: true, name: true } },
          product: { select: { name: true } },
          variant: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Compute totals and per-store breakdown
      let totalSKUs = 0;
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      const storeMap = new Map<string, StoreSummary>();

      for (const sp of storeProducts) {
        const available = sp.stock - sp.reservedStock;
        totalSKUs++;

        if (available <= 0) {
          outOfStock++;
        } else if (available <= LOW_STOCK_THRESHOLD) {
          lowStock++;
        } else {
          inStock++;
        }

        // Per-store aggregation
        let storeSummary = storeMap.get(sp.storeId);
        if (!storeSummary) {
          storeSummary = {
            storeId: sp.store.id,
            storeName: sp.store.name,
            totalSKUs: 0,
            inStock: 0,
            lowStock: 0,
            outOfStock: 0,
          };
          storeMap.set(sp.storeId, storeSummary);
        }
        storeSummary.totalSKUs++;
        if (available <= 0) {
          storeSummary.outOfStock++;
        } else if (available <= LOW_STOCK_THRESHOLD) {
          storeSummary.lowStock++;
        } else {
          storeSummary.inStock++;
        }
      }

      // Recent changes: first 20 (already ordered by updatedAt desc)
      const recentChanges: RecentChange[] = storeProducts.slice(0, 20).map((sp) => ({
        storeProductId: sp.id,
        productName: sp.variant.name
          ? `${sp.product.name} — ${sp.variant.name}`
          : sp.product.name,
        storeName: sp.store.name,
        stock: sp.stock,
        reservedStock: sp.reservedStock,
        availableStock: sp.stock - sp.reservedStock,
        updatedAt: sp.updatedAt.toISOString(),
      }));

      const response: ApiResponse<StockSummary> = {
        success: true,
        data: {
          totals: { totalSKUs, inStock, lowStock, outOfStock },
          byStore: Array.from(storeMap.values()),
          recentChanges,
        },
      };
      return response;
    },
  );
}
