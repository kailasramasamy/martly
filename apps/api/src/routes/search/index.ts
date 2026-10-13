import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { searchLandingQuerySchema, searchLogSchema, searchSuggestQuerySchema } from "@martly/shared/schemas";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { buildSearchLanding } from "../../services/search-landing.js";
import { suggestSearches } from "../../services/search-suggest.js";

const LOG_LIMIT = 30;
const LOG_WINDOW_MS = 60_000;
const logBuckets = new Map<string, { count: number; resetAt: number }>();

// Caps how fast one client can write search logs, so trending can't be stuffed
function allowLog(key: string): boolean {
  const now = Date.now();
  const bucket = logBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    if (logBuckets.size > 10_000) for (const [k, b] of logBuckets) if (now > b.resetAt) logBuckets.delete(k);
    logBuckets.set(key, { count: 1, resetAt: now + LOG_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= LOG_LIMIT;
}

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

  app.get("/suggest", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId, q } = searchSuggestQuerySchema.parse(request.query);
    const store = await findActiveStore(app, storeId);
    if (!store) return reply.notFound("Store not found");
    const data = await suggestSearches(app.prisma, store.id, q);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post("/log", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const body = searchLogSchema.parse(request.body);
    const user = getOrgUser(request);
    if (!allowLog(user.sub || request.ip)) return reply.tooManyRequests("Too many searches");
    const store = await findActiveStore(app, body.storeId);
    if (!store) return reply.notFound("Store not found");
    await app.prisma.searchLog.create({
      data: { storeId: store.id, userId: user.sub || null, query: body.query.replace(/\s+/g, " "), resultCount: body.resultCount },
    });
    return reply.code(201).send({ success: true, data: null });
  });
}
