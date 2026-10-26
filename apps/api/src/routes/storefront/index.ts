import type { FastifyInstance } from "fastify";
import { Permission } from "@martly/shared/constants";
import { storefrontEffectivenessQuerySchema, storefrontHealthQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, StorefrontEffectiveness, StorefrontHealth, StorefrontStoreRow } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgStoreIds, requireOrgContext, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { storefrontEffectiveness } from "../../services/storefront/effectiveness.js";
import { storefrontHealth } from "../../services/storefront/health.js";
import { storefrontStores } from "../../services/storefront/stores.js";
import { storefrontAiRoutes } from "./ai.js";

/** How rich a store's app looks, what shoppers respond to, and AI drafts for what's missing */
export async function storefrontRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requireOrgContext, requirePermission(Permission.MARKETING_MANAGE)] };

  app.get("/health", opts, async (request, reply) => {
    const { storeId, fresh } = storefrontHealthQuerySchema.parse(request.query);
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
    const data = await storefrontHealth(app.prisma, storeId, fresh);
    return { success: true, data } satisfies ApiResponse<StorefrontHealth>;
  });

  app.get("/effectiveness", opts, async (request, reply) => {
    const { storeId, days } = storefrontEffectivenessQuerySchema.parse(request.query);
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
    const store = await app.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { id: true, organizationId: true } });
    const data = await storefrontEffectiveness(app.prisma, store, days);
    return { success: true, data } satisfies ApiResponse<StorefrontEffectiveness>;
  });

  app.get("/stores", opts, async (request) => {
    const data = await storefrontStores(app.prisma, await getOrgStoreIds(request, app.prisma));
    return { success: true, data } satisfies ApiResponse<StorefrontStoreRow[]>;
  });

  await app.register(storefrontAiRoutes, { prefix: "/ai" });
}
