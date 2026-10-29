import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { searchEventSchema, searchLandingQuerySchema, searchLogSchema, searchSuggestQuerySchema } from "@martly/shared/schemas";
import { authenticateOptional } from "../../middleware/auth.js";
import { byClient, rateLimits } from "../../middleware/rate-limit.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { buildSearchLanding } from "../../services/search-landing.js";
import { suggestSearches } from "../../services/search-suggest.js";
import { allowSearchLog, logSearch, recordSearchEvent } from "../../services/search-log.js";

async function findActiveStore(app: FastifyInstance, storeId: string) {
  return app.prisma.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
}

export async function searchRoutes(app: FastifyInstance) {
  app.get("/landing", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId } = searchLandingQuerySchema.parse(request.query);
    const store = await findActiveStore(app, storeId);
    if (!store) return reply.notFound("Store not found");
    const user = getOrgUser(request);
    const data = await buildSearchLanding(app.prisma, store, user.sub || undefined);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // Typeahead fires per keystroke, so the limit is roomy; it stops scripted scraping and query floods
  const suggestLimit = rateLimits(app, [{ max: 120, window: "1 minute", key: byClient }]);

  app.get("/suggest", { preHandler: [authenticateOptional, suggestLimit] }, async (request, reply) => {
    const { storeId, q } = searchSuggestQuerySchema.parse(request.query);
    const store = await findActiveStore(app, storeId);
    if (!store) return reply.notFound("Store not found");
    const data = await suggestSearches(app.prisma, store, q);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post("/log", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const body = searchLogSchema.parse(request.body);
    const user = getOrgUser(request);
    if (!allowSearchLog(user.sub || request.ip)) return reply.tooManyRequests("Too many searches");
    const store = await findActiveStore(app, body.storeId);
    if (!store) return reply.notFound("Store not found");
    const log = await logSearch(app.prisma, { storeId: store.id, userId: user.sub || null, query: body.query, resultCount: body.resultCount });
    return reply.code(201).send({ success: true, data: log } satisfies ApiResponse<typeof log>);
  });

  // A result tapped or added to cart from a logged search: the add-to-cart rate per query and product, for ranking
  app.post("/event", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const body = searchEventSchema.parse(request.body);
    const user = getOrgUser(request);
    if (!allowSearchLog(user.sub || request.ip)) return reply.tooManyRequests("Too many events");
    const missing = await recordSearchEvent(app.prisma, body, user.sub || null);
    if (missing === "search") return reply.notFound("Search not found");
    if (missing === "product") return reply.notFound("Product not found");
    return reply.code(201).send({ success: true, data: null });
  });
}
