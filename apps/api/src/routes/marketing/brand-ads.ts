import type { FastifyInstance } from "fastify";
import { brandAdSettingsSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const owner = { preHandler: [authenticate, requireRole("ORG_ADMIN")] };

/** Store owners' say over brand advertising in their stores: on/off, blocked brands, and opting out of brand discounts */
export async function brandAdRoutes(app: FastifyInstance) {
  async function settings(organizationId: string) {
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { allowBrandAds: true, brandBlocks: { select: { brand: { select: { id: true, name: true, imageUrl: true } } } } },
    });
    return { allowBrandAds: org.allowBrandAds, blockedBrands: org.brandBlocks.map((b) => b.brand) };
  }

  app.get("/brand-ads", staff, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    if (!organizationId) return reply.badRequest("Brand ad settings belong to an organisation");
    return { success: true, data: await settings(organizationId) };
  });

  app.put("/brand-ads", owner, async (request) => {
    const { allowBrandAds, blockedBrandIds } = brandAdSettingsSchema.parse(request.body);
    const organizationId = getOrgUser(request).organizationId!;
    await app.prisma.$transaction([
      app.prisma.organization.update({ where: { id: organizationId }, data: { allowBrandAds } }),
      app.prisma.orgBrandBlock.deleteMany({ where: { organizationId, brandId: { notIn: blockedBrandIds } } }),
      app.prisma.orgBrandBlock.createMany({ data: blockedBrandIds.map((brandId) => ({ organizationId, brandId })), skipDuplicates: true }),
    ]);
    return { success: true, data: await settings(organizationId) };
  });

  // Brand discount campaigns that reach this organisation, and whether it sits them out
  app.get("/brand-ads/campaigns", staff, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    if (!organizationId) return reply.badRequest("Brand campaigns are listed per organisation");
    const campaigns = await app.prisma.brandCampaign.findMany({
      where: { product: { kind: "BRAND_PROMOTION" }, status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true, title: true, status: true, startsAt: true, endsAt: true, discountType: true, discountValue: true,
        brand: { select: { id: true, name: true, imageUrl: true } },
        optOuts: { where: { organizationId }, select: { organizationId: true } },
      },
    });
    return {
      success: true,
      data: campaigns.map(({ optOuts, discountValue, ...c }) => ({ ...c, discountValue: discountValue && Number(discountValue), optedOut: optOuts.length > 0 })),
    };
  });

  app.put<{ Params: { id: string }; Body: { optedOut: boolean } }>("/brand-ads/campaigns/:id/opt-out", owner, async (request, reply) => {
    const organizationId = getOrgUser(request).organizationId!;
    const campaign = await app.prisma.brandCampaign.findUnique({ where: { id: request.params.id }, select: { status: true } });
    if (!campaign) return reply.notFound("Campaign not found");
    // Price cuts are applied when the campaign goes live; after that the owner ends their part from the promotion itself
    if (campaign.status !== "SCHEDULED") return reply.conflict("You can only opt out before the campaign starts");
    const key = { campaignId_organizationId: { campaignId: request.params.id, organizationId } };
    if (request.body?.optedOut) await app.prisma.brandCampaignOptOut.upsert({ where: key, create: key.campaignId_organizationId, update: {} });
    else await app.prisma.brandCampaignOptOut.deleteMany({ where: key.campaignId_organizationId });
    return { success: true, data: { optedOut: Boolean(request.body?.optedOut) } };
  });
}
