import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { storeWalkRouteSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { walkAisle, walkRoute } from "../../services/store-walk.js";

const storeParams = z.object({ storeId: z.string().uuid() });
const aisleParams = storeParams.extend({ categoryId: z.string().uuid() });
const aisleQuery = z.object({ subcategoryId: z.string().uuid().optional(), brandId: z.string().uuid().optional() });

export async function storeWalkRoutes(app: FastifyInstance) {
  const activeStore = (id: string) => app.prisma.store.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true } });

  // The aisles to walk in one department, posted with the cart's lines so covered aisles and missing due items show
  app.post("/:storeId/route", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const params = storeParams.safeParse(request.params);
    const body = storeWalkRouteSchema.safeParse(request.body ?? {});
    if (!params.success) return reply.badRequest("Invalid store id");
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    if (!(await activeStore(params.data.storeId))) return reply.notFound("Store not found");

    const data = await walkRoute(app.prisma, params.data.storeId, getOrgUser(request).sub || null, body.data);
    if (!data) return reply.notFound("Nothing in stock at this store");
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.get("/:storeId/aisles/:categoryId", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const params = aisleParams.safeParse(request.params);
    const query = aisleQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.badRequest("Invalid store, aisle, subcategory or brand id");
    if (!(await activeStore(params.data.storeId))) return reply.notFound("Store not found");

    const data = await walkAisle(app.prisma, params.data.storeId, getOrgUser(request).sub || null, {
      categoryId: params.data.categoryId, subcategoryId: query.data.subcategoryId, brandId: query.data.brandId,
    });
    if (!data) return reply.notFound("Aisle not found");
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });
}
