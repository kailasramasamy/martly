import type { FastifyInstance } from "fastify";
import { cartReviewSchema, cartTransferSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { transferCart } from "../../services/cart-transfer.js";
import { liveStoreWhere } from "../../services/store-resolve.js";
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

  // Moves the cart to another store: the same products at its prices, and the ones it doesn't have
  app.post("/transfer", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const parsed = cartTransferSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const store = await app.prisma.store.findFirst({ where: { ...liveStoreWhere, id: parsed.data.toStoreId }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    const data = await transferCart(app.prisma, parsed.data);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });
}
