import type { FastifyInstance } from "fastify";
import { webSearchEventSchema, webSearchLogSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { webVisitorKey } from "../../middleware/rate-limit.js";
import { allowSearchLog, logSearch, recordSearchEvent } from "../../services/search-log.js";

/** Searches and result taps from martlyshop.in, logged like the app's so trending and ranking count web shoppers */
export function webSearchLogRoutes(app: FastifyInstance) {
  app.post("/search/log", async (request, reply) => {
    const visitor = webVisitorKey(request);
    if (!visitor) return reply.forbidden("Not from martlyshop.in");
    if (!allowSearchLog(visitor)) return reply.tooManyRequests("Too many searches");
    const body = webSearchLogSchema.parse(request.body);
    const store = await app.prisma.store.findFirst({ where: { id: body.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const log = await logSearch(app.prisma, { storeId: store.id, userId: null, query: body.query, resultCount: body.resultCount });
    return reply.code(201).send({ success: true, data: log } satisfies ApiResponse<typeof log>);
  });

  app.post("/search/event", async (request, reply) => {
    const visitor = webVisitorKey(request);
    if (!visitor) return reply.forbidden("Not from martlyshop.in");
    if (!allowSearchLog(visitor)) return reply.tooManyRequests("Too many events");
    const { product, ...body } = webSearchEventSchema.parse(request.body);
    const found = await app.prisma.product.findUnique({ where: { slug: product }, select: { id: true } });
    if (!found) return reply.notFound("Product not found");
    const missing = await recordSearchEvent(app.prisma, { ...body, productId: found.id }, null);
    if (missing) return reply.notFound("Search not found");
    return reply.code(201).send({ success: true, data: null });
  });
}
