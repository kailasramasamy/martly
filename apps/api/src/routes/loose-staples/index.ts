import type { FastifyInstance } from "fastify";
import { Permission } from "@martly/shared/constants";
import { looseStaplesQuerySchema, saveLooseStaplesSchema } from "@martly/shared/schemas";
import type { ApiResponse, LooseStapleAisle } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { looseStaples, saveLooseStaples } from "../../services/loose-staples.js";

/** Unbranded rice, dal, flour… a store sells loose or in its own packs: listed with the owner's prices */
export async function looseStapleRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] };
  const storeOf = (id: string) => app.prisma.store.findUniqueOrThrow({ where: { id }, select: { id: true, organizationId: true } });

  app.get("/", opts, async (request, reply) => {
    const { storeId } = looseStaplesQuerySchema.parse(request.query);
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
    const data = await looseStaples(app.prisma, await storeOf(storeId));
    return { success: true, data } satisfies ApiResponse<LooseStapleAisle[]>;
  });

  app.put("/", opts, async (request, reply) => {
    const input = saveLooseStaplesSchema.parse(request.body);
    if (!(await verifyStoreOrgAccess(request, app.prisma, input.storeId))) return reply.forbidden("Access denied to this store");
    const data = await saveLooseStaples(app.prisma, await storeOf(input.storeId), input, getOrgUser(request).sub);
    return { success: true, data };
  });
}
