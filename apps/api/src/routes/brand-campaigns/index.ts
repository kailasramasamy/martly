import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { billingProfileSchema, brandPartnerSchema, offlinePaymentSchema, reviewBrandCampaignSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { markPaidOffline, reviewCampaign } from "../../services/brand-campaigns/booking.js";
import { lastBrandBilling } from "../../services/marketing/billing.js";
import { endCampaign, launchOrAnnounce } from "../../services/brand-campaigns/go-live.js";
import { campaignContext, campaignRoutes, type CampaignScope } from "./campaign-routes.js";

const scope: CampaignScope = { guard: [authenticate, requireRole("SUPER_ADMIN")], brandOf: async () => null, canBook: true };

/** The Martly team's side of brand campaigns: everything brands can do, plus offline payment, review, ending early and partner accounts */
export async function brandCampaignAdminRoutes(app: FastifyInstance) {
  await app.register(campaignRoutes(scope));
  const { load, detail, opts } = campaignContext(app, scope);

  // The brand's details from its last invoice, so recording a bank transfer only needs the reference
  app.get<{ Params: { id: string } }>("/:id/billing", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    return campaign && { success: true, data: await lastBrandBilling(app.prisma, campaign.brandId) };
  });

  app.post<{ Params: { id: string } }>("/:id/mark-paid", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    const { reference } = offlinePaymentSchema.parse(request.body);
    const b = billingProfileSchema.parse(request.body);
    await markPaidOffline(app.prisma, campaign, { name: b.billingName, gstin: b.gstin || null, address: b.billingAddress, state: b.billingState }, reference, getOrgUser(request).sub, app.fcm);
    return { success: true, data: await detail(campaign.id) };
  });

  app.post<{ Params: { id: string } }>("/:id/review", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    const { approve, note } = reviewBrandCampaignSchema.parse(request.body);
    const reviewed = await reviewCampaign(app.prisma, campaign, approve, note);
    if (approve) await launchOrAnnounce({ prisma: app.prisma, fcm: app.fcm, log: request.log }, reviewed);
    return { success: true, data: await detail(campaign.id) };
  });

  app.post<{ Params: { id: string } }>("/:id/end", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    if (campaign.status !== "LIVE") return reply.conflict("Only a live campaign can be ended");
    await endCampaign(app.prisma, campaign);
    return { success: true, data: await detail(campaign.id) };
  });

  // Districts that have active stores, for aiming a campaign at regions ("Tamil Nadu:Dharmapuri")
  app.get("/regions", opts, async () => {
    const rows = await app.prisma.store.groupBy({
      by: ["state", "district"], where: { status: "ACTIVE", state: { not: null } }, _count: { _all: true }, orderBy: [{ state: "asc" }, { district: "asc" }],
    });
    return { success: true, data: rows.map((r) => ({ state: r.state!, district: r.district, stores: r._count._all })) };
  });

  app.register(brandPartnerRoutes, { prefix: "/partners" });
}

/** Brand partner logins: people at a brand who follow and pay for its campaigns in the portal */
async function brandPartnerRoutes(app: FastifyInstance) {
  const select = { id: true, name: true, email: true, phone: true, createdAt: true, deletedAt: true, brand: { select: { id: true, name: true } } } as const;

  app.get("/", { preHandler: scope.guard }, async () => {
    const partners = await app.prisma.user.findMany({ where: { role: "BRAND_PARTNER" }, orderBy: { createdAt: "desc" }, select });
    return { success: true, data: partners };
  });

  app.post("/", { preHandler: scope.guard }, async (request, reply) => {
    const { password, ...input } = brandPartnerSchema.parse(request.body);
    if (await app.prisma.user.findUnique({ where: { email: input.email } })) return reply.conflict("Someone already uses that email");
    const partner = await app.prisma.user.create({
      data: { ...input, role: "BRAND_PARTNER", passwordHash: await bcrypt.hash(password, 10) }, select,
    });
    return reply.code(201).send({ success: true, data: partner });
  });

  // Removing a partner stops their logins; their brand's campaigns and invoices stay
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: scope.guard }, async (request, reply) => {
    const { count } = await app.prisma.user.updateMany({ where: { id: request.params.id, role: "BRAND_PARTNER" }, data: { deletedAt: new Date() } });
    if (!count) return reply.notFound("Partner not found");
    return { success: true, data: null };
  });
}
