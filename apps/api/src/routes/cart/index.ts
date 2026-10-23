import type { FastifyInstance } from "fastify";
import { cartReviewSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { reviewCart } from "../../services/cart-review.js";

export async function cartRoutes(app: FastifyInstance) {
  // Re-checks the cart's prices and stock when the cart opens or changes, with suggestions to add (see reviewCart)
  app.post("/review", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const parsed = cartReviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const store = await app.prisma.store.findFirst({ where: { id: parsed.data.storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");

    const data = await reviewCart(app.prisma, getOrgUser(request).sub || null, store, parsed.data);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });
}
