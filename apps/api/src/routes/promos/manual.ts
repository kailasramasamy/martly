import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createManualPromoSchema, generateBannerImageSchema, promoBannerUpdateSchema } from "@martly/shared/schemas";
import type { ApiResponse, PromoDetail } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isMediaUrl } from "../../services/media.js";
import { chargePromotion, getEntitlements } from "../../services/marketing/entitlements.js";
import { generateBannerImage } from "../../services/marketing/banner-image.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { createManualPromo, regeneratePromoImage, updatePromoBanner } from "../../services/promo/manual.js";
import { toDetail } from "../../services/promo/view.js";

const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const MEDIA_ONLY = "Upload the banner image through Martly (or generate it with AI)";

/** Manual promotions, a promotion's banner, and AI-made banner images */
export async function manualPromoRoutes(app: FastifyInstance) {
  const deps = () => ({ prisma: app.prisma, fcm: app.fcm, log: app.log });
  const orgFilter = (request: FastifyRequest) => {
    const user = getOrgUser(request);
    return user.role === "SUPER_ADMIN" ? undefined : user.organizationId;
  };
  async function load(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const organizationId = orgFilter(request);
    const promo = await app.prisma.promo.findFirst({ where: { id: request.params.id, ...(organizationId ? { organizationId } : {}) } });
    if (!promo) reply.notFound("Promotion not found");
    return promo;
  }
  const detail = async (request: FastifyRequest, id: string) =>
    ({ success: true, data: (await toDetail(app.prisma, id, orgFilter(request)))! }) satisfies ApiResponse<PromoDetail>;

  app.post("/manual", staff, async (request, reply) => {
    const { organizationId: requested, ...input } = createManualPromoSchema.parse(request.body);
    const user = getOrgUser(request);
    const platform = user.role === "SUPER_ADMIN";
    const organizationId = platform ? requested : user.organizationId;
    if (!organizationId) return reply.badRequest("Choose an organisation for this promotion");
    if (!isMediaUrl(input.imageUrl)) return reply.badRequest(MEDIA_ONLY);
    // Push notifications to shoppers are part of the higher plans; Martly's own promotions always may
    const notify = input.notify && (platform || (await getEntitlements(app.prisma, organizationId)).pushIncluded);
    const promo = await createManualPromo(deps(), { ...input, notify }, { organizationId, createdById: user.sub }, platform ? undefined : chargePromotion);
    return reply.code(201).send(await detail(request, promo.id));
  });

  // An image for a promotion that doesn't exist yet (the create form); uses one of the month's AI images
  app.post("/generate-image", staff, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI images need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const body = generateBannerImageSchema.parse(request.body);
    const user = getOrgUser(request);
    const organizationId = user.role === "SUPER_ADMIN" ? null : (user.organizationId ?? null);
    const art = await generateBannerImage(app, organizationId, body, (m) => request.log.warn(`banner image: ${m}`));
    return { success: true, data: art };
  });

  app.put<{ Params: { id: string } }>("/:id/banner", staff, async (request, reply) => {
    const promo = await load(request, reply);
    if (!promo) return;
    const input = promoBannerUpdateSchema.parse(request.body);
    if (input.imageUrl && !isMediaUrl(input.imageUrl)) return reply.badRequest(MEDIA_ONLY);
    await updatePromoBanner(app.prisma, promo, input);
    return detail(request, promo.id);
  });

  app.post<{ Params: { id: string } }>("/:id/banner/generate", staff, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI images need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const promo = await load(request, reply);
    if (!promo) return;
    await regeneratePromoImage(app, promo, request.log);
    return detail(request, promo.id);
  });
}
