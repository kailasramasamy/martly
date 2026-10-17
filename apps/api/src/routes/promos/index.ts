import type { FastifyInstance, FastifyRequest } from "fastify";
import { createPromoSchema, promoListQuerySchema, updatePromoItemsSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, PromoDetail, PromoSummary } from "@martly/shared/types";
import { Permission, PromoStatus } from "@martly/shared/constants";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { discardPromo, endPromo, keepPromoItems, launchPromo, regeneratePromo, reopenPromo, startPromoDraft } from "../../services/promo/lifecycle.js";
import { chargePromotion, getEntitlements } from "../../services/marketing/entitlements.js";
import { getMarketingConfig } from "../../services/marketing/config.js";
import { isMediaUrl } from "../../services/media.js";
import { promoSummaryInclude, toDetail, toSummary } from "../../services/promo/view.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";

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

  app.get("/", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    const { page, pageSize } = promoListQuerySchema.parse(request.query);
    const { status } = request.query as { status?: string };
    const organizationId = orgFilter(request);
    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(status && status in PromoStatus ? { status: status as PromoStatus } : {}),
    };
    const [rows, total] = await Promise.all([
      app.prisma.promo.findMany({ where, include: promoSummaryInclude, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.promo.count({ where }),
    ]);
    return {
      success: true, data: rows.map(toSummary), meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    } satisfies PaginatedResponse<PromoSummary>;
  });

  app.post("/", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI promos need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const { organizationId: requested, imageUrl, ...body } = createPromoSchema.parse(request.body);
    const user = getOrgUser(request);
    const platform = user.role === "SUPER_ADMIN";
    const organizationId = platform ? requested : user.organizationId;
    if (!organizationId) return reply.badRequest("Choose an organisation for this promo");
    if (imageUrl && !isMediaUrl(imageUrl)) return reply.badRequest("Upload the banner image through Martly");
    // Push notifications to shoppers are part of the higher plans; Martly's own promos always may
    const notify = body.notify && (platform || (await getEntitlements(app.prisma, organizationId)).pushIncluded);
    const promo = await startPromoDraft(
      deps(),
      { ...body, notify, organizationId, createdById: user.sub, uploadedImageUrl: imageUrl ?? null, chargedFrom: platform ? "PLATFORM" : undefined },
      platform ? undefined : chargePromotion,
    );
    return reply.code(201).send({ success: true, data: { id: promo.id, status: promo.status } });
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.patch<{ Params: { id: string } }>("/:id/items", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    const { productIds } = updatePromoItemsSchema.parse(request.body);
    await detailOr404(request);
    await keepPromoItems(app.prisma, request.params.id, productIds);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/launch", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    await detailOr404(request);
    await launchPromo(deps(), request.params.id);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/end", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    await detailOr404(request);
    await endPromo(app.prisma, request.params.id, true);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/reopen", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    await detailOr404(request);
    await reopenPromo(app.prisma, request.params.id, getOrgUser(request).role === "SUPER_ADMIN" ? undefined : chargePromotion);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/regenerate", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    await detailOr404(request);
    const { freeRegenerations } = await getMarketingConfig(app.prisma);
    await regeneratePromo(deps(), request.params.id, freeRegenerations);
    return { success: true, data: await detailOr404(request) } satisfies ApiResponse<PromoDetail>;
  });

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    await detailOr404(request);
    await discardPromo(app.prisma, request.params.id);
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}
