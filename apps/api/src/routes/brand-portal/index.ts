import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { invoiceLink } from "../../services/marketing/invoice.js";
import type { BillingSnapshot } from "../../services/marketing/billing.js";
import { campaignRoutes, type CampaignScope } from "../brand-campaigns/campaign-routes.js";

/** A brand partner acts only for the brand their login is linked to */
async function partnerBrand(app: FastifyInstance, request: FastifyRequest) {
  const user = await app.prisma.user.findUnique({ where: { id: request.user.sub }, select: { brandId: true } });
  if (!user?.brandId) throw Object.assign(new Error("This login isn't linked to a brand"), { statusCode: 403 });
  return user.brandId;
}

/** The brand portal: brand partners book, pay for and follow their own campaigns */
export async function brandPortalRoutes(app: FastifyInstance) {
  const guard = [authenticate, requireRole("BRAND_PARTNER")];
  const scope: CampaignScope = { guard, brandOf: (request) => partnerBrand(app, request) };
  await app.register(campaignRoutes(scope), { prefix: "/campaigns" });

  app.get("/orders", { preHandler: guard }, async (request) => {
    const brandId = await partnerBrand(app, request);
    const orders = await app.prisma.adOrder.findMany({
      where: { brandId, status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 100,
      include: { product: { select: { name: true } }, campaign: { select: { id: true, title: true } } },
    });
    return {
      success: true,
      data: orders.map((o) => ({
        id: o.id, number: o.number, product: o.product.name, campaign: o.campaign, quantity: o.quantity, total: Number(o.total),
        status: o.status, paidAt: o.paidAt, invoiceUrl: o.number ? invoiceLink(o.id) : null,
      })),
    };
  });

  // Billing details from the brand's last order, to prefill the next checkout
  app.get("/billing", { preHandler: guard }, async (request) => {
    const brandId = await partnerBrand(app, request);
    const last = await app.prisma.adOrder.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" }, select: { billing: true } });
    const b = last?.billing as unknown as BillingSnapshot | undefined;
    return { success: true, data: b ? { billingName: b.name, gstin: b.gstin, billingAddress: b.address, billingState: b.state } : null };
  });
}
