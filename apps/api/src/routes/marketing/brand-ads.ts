import type { FastifyInstance } from "fastify";
import { brandAdSettingsSchema } from "@martly/shared/schemas";
import type { Prisma } from "../../../generated/prisma/client.js";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { storesTargeted } from "../../services/brand-campaigns/targeting.js";

const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const owner = { preHandler: [authenticate, requireRole("ORG_ADMIN")] };
const BRAND_REF = { id: true, name: true, imageUrl: true } as const;
const CAMPAIGN_SELECT = {
  id: true, title: true, status: true, startsAt: true, endsAt: true, discountType: true, discountValue: true, brandId: true,
  targetStoreIds: true, targetStates: true, targetDistricts: true,
  brand: { select: BRAND_REF }, product: { select: { name: true } },
} as const;

/**
 * Brands in an organisation's stores. Brands pay Martly for reach, so campaigns (featured brands among them) are
 * Martly's to sell; owners see them, and choose only whether their own brands lead.
 */
export async function brandAdRoutes(app: FastifyInstance) {
  // Live and upcoming campaigns aimed at one of the organisation's stores that carries the brand
  async function reaching(organizationId: string, where: Prisma.BrandCampaignWhereInput) {
    const campaigns = await app.prisma.brandCampaign.findMany({ where, orderBy: { startsAt: "asc" }, select: CAMPAIGN_SELECT });
    const stores = await Promise.all(campaigns.map((c) => app.prisma.store.count({
      where: { organizationId, status: "ACTIVE", ...storesTargeted(c), storeProducts: { some: { isActive: true, product: { brandId: c.brandId } } } },
    })));
    return campaigns.filter((_, i) => stores[i] > 0);
  }

  async function settings(organizationId: string) {
    const org = await app.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { boostOwnBrands: true } });
    const featured = await reaching(organizationId, { status: "LIVE", product: { kind: "BRAND_FEATURE" } });
    return { boostOwnBrands: org.boostOwnBrands, featuredBrands: [...new Map(featured.map((c) => [c.brand.id, c.brand])).values()] };
  }

  app.get("/brand-ads", staff, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    if (!organizationId) return reply.badRequest("Brand ad settings belong to an organisation");
    return { success: true, data: await settings(organizationId) };
  });

  app.put("/brand-ads", owner, async (request, reply) => {
    const parsed = brandAdSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const organizationId = getOrgUser(request).organizationId!;
    await app.prisma.organization.update({ where: { id: organizationId }, data: { boostOwnBrands: parsed.data.boostOwnBrands } });
    return { success: true, data: await settings(organizationId) };
  });

  app.get("/brand-ads/campaigns", staff, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    if (!organizationId) return reply.badRequest("Brand campaigns are listed per organisation");
    const campaigns = await reaching(organizationId, { status: { in: ["SCHEDULED", "LIVE"] } });
    return {
      success: true,
      data: campaigns.map((c) => ({
        id: c.id, title: c.title, status: c.status, startsAt: c.startsAt, endsAt: c.endsAt, brand: c.brand, packageName: c.product.name,
        discountType: c.discountType, discountValue: c.discountValue && Number(c.discountValue),
      })),
    };
  });
}
