import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BRAND_RANKING_LEVELS, brandRankingRegionSchema, brandRankingSchema } from "@martly/shared/schemas";
import type { ApiResponse, BrandRankingRow } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { rankingFor, resetRanking, saveRanking } from "../../services/brand-ranking.js";

const scopeParams = z.object({ level: z.enum(BRAND_RANKING_LEVELS), id: z.string().uuid() });
const regionQuery = z.object({ region: brandRankingRegionSchema });

/** Martly's brand order within a category or subcategory, per region (SUPER_ADMIN) */
export async function brandRankingRoutes(app: FastifyInstance) {
  const platform = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };

  app.get("/:level/:id", platform, async (request, reply) => {
    const params = scopeParams.safeParse(request.params);
    const query = regionQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.badRequest("Invalid level, id or region");
    const data = await rankingFor(app.prisma, { ...params.data, region: query.data.region });
    if (!data) return reply.notFound("Category not found");
    return { success: true, data } satisfies ApiResponse<BrandRankingRow[]>;
  });

  app.put("/:level/:id", platform, async (request, reply) => {
    const params = scopeParams.safeParse(request.params);
    const body = brandRankingSchema.safeParse(request.body);
    if (!params.success) return reply.badRequest("Invalid level or id");
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    const scope = { ...params.data, region: body.data.region };
    if (!(await saveRanking(app.prisma, scope, body.data.brandIds))) return reply.notFound("Category not found");
    return { success: true, data: await rankingFor(app.prisma, scope) } satisfies ApiResponse<BrandRankingRow[] | null>;
  });

  app.delete("/:level/:id", platform, async (request, reply) => {
    const params = scopeParams.safeParse(request.params);
    const query = regionQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.badRequest("Invalid level, id or region");
    const scope = { ...params.data, region: query.data.region };
    await resetRanking(app.prisma, scope);
    const data = await rankingFor(app.prisma, scope);
    if (!data) return reply.notFound("Category not found");
    return { success: true, data } satisfies ApiResponse<BrandRankingRow[]>;
  });
}
