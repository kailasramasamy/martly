import type { FastifyInstance, FastifyRequest } from "fastify";
import { createPromoSchema, promoListQuerySchema, updatePromoItemsSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, PromoDetail, PromoSummary } from "@martly/shared/types";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { discardPromo, endPromo, keepPromoItems, launchPromo, reopenPromo, startPromoDraft } from "../../services/promo/lifecycle.js";
import { promoSummaryInclude, toDetail, toSummary } from "../../services/promo/view.js";
import { ADMINS } from "../collections/access.js";

// SUPER_ADMIN sees every organisation's promos; ORG_ADMIN only their own
const orgFilter = (request: FastifyRequest) => {
  const user = getOrgUser(request);
  return user.role === "SUPER_ADMIN" ? undefined : user.organizationId;
};

export async function promoRoutes(app: FastifyInstance) {
  const deps = () => ({ prisma: app.prisma, fcm: app.fcm, log: app.log });

  async function detailOr404(request: FastifyRequest<{ Params: { id: string } }>) {
    const detail = await toDetail(app.prisma, request.params.id, orgFilter(request));
    if (!detail) throw Object.assign(new Error("Promo not found"), { statusCode: 404 });
    return detail;
  }

  app.get("/", { preHandler: ADMINS }, async (request) => {
    const { page, pageSize } = promoListQuerySchema.parse(request.query);
    const organizationId = orgFilter(request);
    const where = organizationId ? { organizationId } : {};
    const [rows, total] = await Promise.all([
      app.prisma.promo.findMany({ where, include: promoSummaryInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.promo.count({ where }),
    ]);
    return {
      success: true, data: rows.map(toSummary), meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    } satisfies PaginatedResponse<PromoSummary>;
  });

  app.post("/", { preHandler: ADMINS }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI promos need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const { organizationId: requested, ...body } = createPromoSchema.parse(request.body);
    const user = getOrgUser(request);
    const organizationId = user.role === "SUPER_ADMIN" ? requested : user.organizationId;
    if (!organizationId) return reply.badRequest("Choose an organisation for this promo");
    const promo = await startPromoDraft(deps(), { ...body, organizationId, createdById: user.sub });
    return reply.code(201).send({ success: true, data: { id: promo.id, status: promo.status } });
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: ADMINS }, async (request) => {
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.patch<{ Params: { id: string } }>("/:id/items", { preHandler: ADMINS }, async (request) => {
    const { productIds } = updatePromoItemsSchema.parse(request.body);
    await detailOr404(request);
    await keepPromoItems(app.prisma, request.params.id, productIds);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/launch", { preHandler: ADMINS }, async (request) => {
    await detailOr404(request);
    await launchPromo(deps(), request.params.id);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/end", { preHandler: ADMINS }, async (request) => {
    await detailOr404(request);
    await endPromo(app.prisma, request.params.id, true);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/reopen", { preHandler: ADMINS }, async (request) => {
    await detailOr404(request);
    await reopenPromo(app.prisma, request.params.id);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: ADMINS }, async (request) => {
    await detailOr404(request);
    await discardPromo(app.prisma, request.params.id);
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}
