import type { FastifyInstance } from "fastify";
import { homeSectionsQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, HomeSectionsPage } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { homeSectionsPage } from "../../services/home/page.js";

export async function homeSectionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { storeId: string } }>("/:storeId/sections", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { cursor } = homeSectionsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({
      where: { id: request.params.storeId, status: "ACTIVE" },
      select: { id: true, organizationId: true, freeDeliveryThreshold: true },
    });
    if (!store) return reply.notFound("Store not found");
    const data = await homeSectionsPage(app.prisma, store, getOrgUser(request).sub, cursor);
    return { success: true, data } satisfies ApiResponse<HomeSectionsPage>;
  });
}
