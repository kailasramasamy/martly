import { timingSafeEqual } from "crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { webSearchEventSchema, webSearchLogSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { allowSearchLog, logSearch, recordSearchEvent } from "../../services/search-log.js";

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Every martlyshop.in visitor reaches the API from the site's server, so the site names the visitor and the rate limit
 * counts each one on their own. The site proves it is the site with WEB_API_SECRET; without one set, only outside
 * production. Null when the request can't be trusted.
 */
function visitorKey(request: FastifyRequest) {
  const secret = process.env.WEB_API_SECRET;
  const sent = request.headers["x-martly-web-secret"];
  const trusted = secret ? typeof sent === "string" && sameSecret(sent, secret) : process.env.NODE_ENV !== "production";
  const visitor = request.headers["x-martly-visitor"];
  return trusted && typeof visitor === "string" && visitor ? `web:${visitor.slice(0, 64)}` : null;
}

/** Searches and result taps from martlyshop.in, logged like the app's so trending and ranking count web shoppers */
export function webSearchLogRoutes(app: FastifyInstance) {
  app.post("/search/log", async (request, reply) => {
    const visitor = visitorKey(request);
    if (!visitor) return reply.forbidden("Not from martlyshop.in");
    if (!allowSearchLog(visitor)) return reply.tooManyRequests("Too many searches");
    const body = webSearchLogSchema.parse(request.body);
    const store = await app.prisma.store.findFirst({ where: { id: body.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const log = await logSearch(app.prisma, { storeId: store.id, userId: null, query: body.query, resultCount: body.resultCount });
    return reply.code(201).send({ success: true, data: log } satisfies ApiResponse<typeof log>);
  });

  app.post("/search/event", async (request, reply) => {
    const visitor = visitorKey(request);
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
