import type { FastifyInstance } from "fastify";
import { brandAdSettingsSchema, orgFeaturedBrandsSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { storesTargeted } from "../../services/brand-campaigns/targeting.js";

const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const owner = { preHandler: [authenticate, requireRole("ORG_ADMIN")] };
const martly = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };
const BRAND_REF = { id: true, name: true, imageUrl: true } as const;

/**
 * Brands in an organisation's stores. Brands pay Martly for reach, so campaigns and featured brands are Martly's to
 * set; owners see them, and choose only whether their own brands lead.
 */
export async function brandAdRoutes(app: FastifyInstance) {
  const featured = async (organizationId: string) =>
    (await app.prisma.orgBrandFeature.findMany({ where: { organizationId }, select: { brand: { select: BRAND_REF } }, orderBy: { createdAt: "asc" } }))
      .map((f) => f.brand);

  async function settings(organizationId: string) {
    const org = await app.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { boostOwnBrands: true } });
    return { boostOwnBrands: org.boostOwnBrands, featuredBrands: await featured(organizationId) };
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

  // Brand campaigns coming up or running in this organisation's stores: aimed at one of them, for a brand it stocks
  app.get("/brand-ads/campaigns", staff, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    if (!organizationId) return reply.badRequest("Brand campaigns are listed per organisation");
    const campaigns = await app.prisma.brandCampaign.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true, title: true, status: true, startsAt: true, endsAt: true, discountType: true, discountValue: true, brandId: true,
        targetStoreIds: true, targetStates: true, targetDistricts: true,
        brand: { select: BRAND_REF }, product: { select: { name: true } },
      },
    });
    const reaching = await Promise.all(campaigns.map((c) => app.prisma.store.count({
      where: { organizationId, status: "ACTIVE", ...storesTargeted(c), storeProducts: { some: { isActive: true, product: { brandId: c.brandId } } } },
    })));
    return {
      success: true,
      data: campaigns
        .filter((_, i) => reaching[i] > 0)
        .map((c) => ({
          id: c.id, title: c.title, status: c.status, startsAt: c.startsAt, endsAt: c.endsAt, brand: c.brand, packageName: c.product.name,
          discountType: c.discountType, discountValue: c.discountValue && Number(c.discountValue),
        })),
    };
  });

  app.get<{ Params: { organizationId: string } }>("/brand-ads/orgs/:organizationId/featured", martly, async (request) => {
    return { success: true, data: await featured(request.params.organizationId) };
  });

  app.put<{ Params: { organizationId: string } }>("/brand-ads/orgs/:organizationId/featured", martly, async (request, reply) => {
    const parsed = orgFeaturedBrandsSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const { organizationId } = request.params;
    const { brandIds } = parsed.data;
    if (!(await app.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) return reply.notFound("Organisation not found");
    await app.prisma.$transaction([
      app.prisma.orgBrandFeature.deleteMany({ where: { organizationId, brandId: { notIn: brandIds } } }),
      app.prisma.orgBrandFeature.createMany({ data: brandIds.map((brandId) => ({ organizationId, brandId })), skipDuplicates: true }),
    ]);
    return { success: true, data: await featured(organizationId) };
  });
}
