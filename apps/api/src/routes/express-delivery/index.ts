import type { FastifyInstance } from "fastify";
import { upsertExpressDeliveryConfigSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";

export async function expressDeliveryRoutes(app: FastifyInstance) {
  // GET /config?storeId=X — Get express delivery config for a store
  app.get("/config", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const config = await app.prisma.expressDeliveryConfig.findUnique({
      where: { storeId },
    });

    const response: ApiResponse<typeof config> = { success: true, data: config };
    return response;
  });

  // PUT /config?storeId=X — Upsert express delivery config
  app.put("/config", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const body = upsertExpressDeliveryConfigSchema.parse(request.body);

    const config = await app.prisma.expressDeliveryConfig.upsert({
      where: { storeId },
      create: {
        storeId,
        isEnabled: body.isEnabled,
        etaMinutes: body.etaMinutes ?? null,
        operatingStart: body.operatingStart ?? null,
        operatingEnd: body.operatingEnd ?? null,
      },
      update: {
        isEnabled: body.isEnabled,
        etaMinutes: body.etaMinutes ?? null,
        operatingStart: body.operatingStart ?? null,
        operatingEnd: body.operatingEnd ?? null,
      },
    });

    const response: ApiResponse<typeof config> = { success: true, data: config };
    return response;
  });
}
