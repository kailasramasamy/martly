import type { FastifyInstance } from "fastify";
import { cartBuilderOutcomeSchema, listToCartLineSchema, listToCartSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { ListUnreadableError, matchText } from "../../services/cart-builder/index.js";
import { streamBuild } from "../../services/cart-builder/stream.js";
import { createRateLimiter } from "../../services/rate-limit.js";

const checkRateLimit = createRateLimiter(10, 60_000);

export async function listToCartRoutes(app: FastifyInstance) {
  // A spoken or written shopping list → matched products per line, streamed (see streamBuild); nothing is added to the cart here
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = listToCartSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    if (!checkRateLimit(user.sub)) return reply.tooManyRequests("Too many lists. Please wait a moment.");

    const store = await app.prisma.store.findFirst({ where: { id: parsed.data.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    await streamBuild(reply, app.prisma, { userId: user.sub, ...parsed.data });
  });

  // One re-worded line searched again during review (e.g. "500g Nandini ghee" → "500g ghee"); shares the list rate limit
  app.post("/line", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = listToCartLineSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    if (!checkRateLimit(user.sub)) return reply.tooManyRequests("Too many searches. Please wait a moment.");

    const store = await app.prisma.store.findFirst({ where: { id: parsed.data.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    try {
      const lines = await matchText(app.prisma, { userId: user.sub, ...parsed.data });
      return { success: true, data: lines } satisfies ApiResponse<typeof lines>;
    } catch (err) {
      if (err instanceof ListUnreadableError) return reply.unprocessableEntity("We couldn't read that. Please try again.");
      throw err;
    }
  });

  // What the customer kept from a run, for measuring how often the first match was right
  app.post<{ Params: { runId: string } }>("/:runId/outcome", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = cartBuilderOutcomeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const { count } = await app.prisma.cartBuilderRun.updateMany({
      where: { id: request.params.runId, userId: user.sub },
      data: { chosen: parsed.data.chosen },
    });
    if (count === 0) return reply.notFound("List not found");
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}
