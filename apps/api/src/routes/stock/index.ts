import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { Prisma } from "../../../generated/prisma/index.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgStoreIds, getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { stockMovementRoutes } from "./movements.js";
import { stockCountRoutes } from "./counts.js";

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

type Db = FastifyInstance["prisma"];

/** Per-store stock health counted in SQL — scanning every store product in JS took seconds */
async function summarizeByStore(prisma: Db, scopeIds: string[] | undefined): Promise<StoreSummary[]> {
  const scope = scopeIds ? Prisma.sql`WHERE sp.store_id = ANY(${scopeIds})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ store_id: string; store_name: string; total: bigint; in_stock: bigint; low: bigint; out: bigint }[]>`
    SELECT sp.store_id, s.name AS store_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE sp.stock - sp.reserved_stock > ${LOW_STOCK_THRESHOLD}) AS in_stock,
      COUNT(*) FILTER (WHERE sp.stock - sp.reserved_stock > 0 AND sp.stock - sp.reserved_stock <= ${LOW_STOCK_THRESHOLD}) AS low,
      COUNT(*) FILTER (WHERE sp.stock - sp.reserved_stock <= 0) AS out
    FROM store_products sp JOIN stores s ON s.id = sp.store_id
    ${scope}
    GROUP BY sp.store_id, s.name`;
  return rows.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    totalSKUs: Number(r.total),
    inStock: Number(r.in_stock),
    lowStock: Number(r.low),
    outOfStock: Number(r.out),
  }));
}

async function recentStockChanges(prisma: Db, scopeIds: string[] | undefined): Promise<RecentChange[]> {
  const rows = await prisma.storeProduct.findMany({
    where: scopeIds ? { storeId: { in: scopeIds } } : {},
    include: {
      store: { select: { name: true } },
      product: { select: { name: true } },
      variant: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return rows.map((sp) => ({
    storeProductId: sp.id,
    productName: sp.variant.name ? `${sp.product.name} \u2014 ${sp.variant.name}` : sp.product.name,
    storeName: sp.store.name,
    stock: sp.stock,
    reservedStock: sp.reservedStock,
    availableStock: sp.stock - sp.reservedStock,
    updatedAt: sp.updatedAt.toISOString(),
  }));
}

export async function stockRoutes(app: FastifyInstance) {
  await app.register(stockMovementRoutes);
  await app.register(stockCountRoutes);

  app.get(
    "/summary",
    { preHandler: [authenticate, requirePermission(Permission.STOCK_VIEW)] },
    async (request, reply) => {
      const { storeId, organizationId } = request.query as {
        storeId?: string;
        organizationId?: string;
      };

      const user = getOrgUser(request);

      if (storeId && !(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
        return reply.forbidden("Access denied");
      }

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

      const scopeIds = storeId ? [storeId] : orgStoreIds;
      const [byStore, recentChanges] = await Promise.all([
        summarizeByStore(app.prisma, scopeIds),
        recentStockChanges(app.prisma, scopeIds),
      ]);
      const totals = byStore.reduce(
        (t, s) => ({
          totalSKUs: t.totalSKUs + s.totalSKUs,
          inStock: t.inStock + s.inStock,
          lowStock: t.lowStock + s.lowStock,
          outOfStock: t.outOfStock + s.outOfStock,
        }),
        { totalSKUs: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
      );

      const response: ApiResponse<StockSummary> = {
        success: true,
        data: {
          totals,
          byStore,
          recentChanges,
        },
      };
      return response;
    },
  );
}
