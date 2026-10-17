import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createManualPromoSchema, promoBannerSchema, updatePromoBannerSchema } from "@martly/shared/schemas";
import type { ApiResponse, PromoDetail } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isMediaUrl } from "../../services/media.js";
import { getEntitlements } from "../../services/marketing/entitlements.js";
import { addPromoBanner, createManualPromo, removePromoBanner, updatePromoBanner } from "../../services/promo/manual.js";
import { toDetail } from "../../services/promo/view.js";

const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const MEDIA_ONLY = "Upload banner images through Martly (or generate them with AI)";

/** Manual promotions and the banners every promotion runs */
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
    if (input.banners.some((b) => !isMediaUrl(b.imageUrl))) return reply.badRequest(MEDIA_ONLY);
    // Push notifications to shoppers are part of the higher plans; Martly's own promotions always may
    const notify = input.notify && (platform || (await getEntitlements(app.prisma, organizationId)).pushIncluded);
    const promo = await createManualPromo(deps(), { ...input, notify }, organizationId, user.sub);
    return reply.code(201).send(await detail(request, promo.id));
  });

  app.post<{ Params: { id: string } }>("/:id/banners", staff, async (request, reply) => {
    const promo = await load(request, reply);
    if (!promo) return;
    const input = promoBannerSchema.parse(request.body);
    if (!isMediaUrl(input.imageUrl)) return reply.badRequest(MEDIA_ONLY);
    await addPromoBanner(app.prisma, promo, input);
    return reply.code(201).send(await detail(request, promo.id));
  });

  app.put<{ Params: { id: string; bannerId: string } }>("/:id/banners/:bannerId", staff, async (request, reply) => {
    const promo = await load(request, reply);
    if (!promo) return;
    const input = updatePromoBannerSchema.parse(request.body);
    if (input.imageUrl && !isMediaUrl(input.imageUrl)) return reply.badRequest(MEDIA_ONLY);
    await updatePromoBanner(app.prisma, promo, request.params.bannerId, input);
    return detail(request, promo.id);
  });

  app.delete<{ Params: { id: string; bannerId: string } }>("/:id/banners/:bannerId", staff, async (request, reply) => {
    const promo = await load(request, reply);
    if (!promo) return;
    await removePromoBanner(app.prisma, promo, request.params.bannerId);
    return detail(request, promo.id);
  });
}
