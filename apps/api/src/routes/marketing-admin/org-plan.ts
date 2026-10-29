import type { FastifyInstance } from "fastify";
import { grantOrgPlanSchema, orgPlanOverridesSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

const platform = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Martly's per-organisation plan tools: the beta-store switches, and a plan given without payment */
export function orgPlanRoutes(app: FastifyInstance) {
  app.patch<{ Params: { id: string } }>("/organizations/:id", platform, async (request, reply) => {
    const data = orgPlanOverridesSchema.parse(request.body);
    const org = await app.prisma.organization.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!org) return reply.notFound("Organization not found");
    const updated = await app.prisma.organization.update({
      where: { id: org.id }, data, select: { id: true, webStoreAlwaysOn: true, unlimitedListings: true },
    });
    return { success: true, data: updated };
  });

  // Starts now and wins over a running plan while it lasts, as the newest period does in getEntitlements
  app.post<{ Params: { id: string } }>("/organizations/:id/plan", platform, async (request, reply) => {
    const { productCode, days } = grantOrgPlanSchema.parse(request.body);
    const [org, product] = await Promise.all([
      app.prisma.organization.findUnique({ where: { id: request.params.id }, select: { id: true } }),
      app.prisma.adProduct.findUniqueOrThrow({ where: { code: productCode } }),
    ]);
    if (!org) return reply.notFound("Organization not found");
    const startsAt = new Date();
    const period = await app.prisma.orgPlanPeriod.create({
      data: { organizationId: org.id, productId: product.id, startsAt, endsAt: new Date(startsAt.getTime() + days * DAY_MS) },
      select: { startsAt: true, endsAt: true },
    });
    return reply.code(201).send({ success: true, data: { ...period, plan: { name: product.name, code: product.code } } });
  });
}
