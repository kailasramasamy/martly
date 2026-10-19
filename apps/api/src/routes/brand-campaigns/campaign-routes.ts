import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { billingProfileSchema, brandCampaignSchema, verifyAdPaymentSchema } from "@martly/shared/schemas";
import type { BrandCampaignStatus } from "@martly/shared/constants";
import type { Prisma } from "../../../generated/prisma/client.js";
import { verifyRazorpaySignature } from "../../services/payment.js";
import { fulfilAdOrder } from "../../services/marketing/billing.js";
import { invoiceLink } from "../../services/marketing/invoice.js";
import { availability, cancelCampaign, checkoutCampaign, createCampaign, updateCampaign, windowFor } from "../../services/brand-campaigns/booking.js";
import { generateCampaignArt } from "../../services/brand-campaigns/art.js";
import { campaignResults, claimsCsv } from "../../services/brand-campaigns/reports.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { getMarketingConfig } from "../../services/marketing/config.js";

const BRAND_KINDS = ["BRAND_BANNER", "BRAND_TAKEOVER", "BRAND_PROMOTION", "BRAND_CPM"] as const;
const DETAIL_INCLUDE = {
  brand: { select: { id: true, name: true, imageUrl: true } },
  product: { select: { id: true, code: true, name: true, kind: true, price: true, durationDays: true, viewsPerUnit: true } },
  category: { select: { id: true, name: true } },
  adOrder: { select: { id: true, number: true, status: true, total: true, paidAt: true } },
  _count: { select: { promos: true, optOuts: true } },
} as const;

/** Who is asking: the platform admin sees every brand; a brand partner only their own */
export interface CampaignScope {
  guard: preHandlerHookHandler[];
  /** The brand the caller is limited to, or null for the platform admin */
  brandOf: (request: FastifyRequest) => Promise<string | null>;
}

/** Loading a campaign within the caller's scope, and its full detail */
export function campaignContext(app: FastifyInstance, scope: CampaignScope) {
  async function load(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const brandId = await scope.brandOf(request);
    const campaign = await app.prisma.brandCampaign.findFirst({ where: { id: request.params.id, ...(brandId ? { brandId } : {}) } });
    if (!campaign) reply.notFound("Campaign not found");
    return campaign;
  }
  async function detail(id: string) {
    const c = await app.prisma.brandCampaign.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
    const results = c.status === "LIVE" || c.status === "ENDED" ? await campaignResults(app.prisma, c) : null;
    return { ...listRow(c), adOrder: c.adOrder && { ...c.adOrder, total: Number(c.adOrder.total), invoiceUrl: c.adOrder.number ? invoiceLink(c.adOrder.id) : null }, results };
  }
  return { load, detail, opts: { preHandler: scope.guard } };
}

type Row = Prisma.BrandCampaignGetPayload<{ include: typeof DETAIL_INCLUDE }>;
const listRow = (c: Row) => ({
  ...c, discountValue: c.discountValue && Number(c.discountValue),
  product: { ...c.product, price: Number(c.product.price) },
  adOrder: c.adOrder && { ...c.adOrder, total: Number(c.adOrder.total) },
});

function readRoutes(app: FastifyInstance, scope: CampaignScope, { load, detail, opts }: ReturnType<typeof campaignContext>) {
  app.get("/packages", opts, async () => {
    const [products, { gstPercent }] = await Promise.all([
      app.prisma.adProduct.findMany({ where: { kind: { in: [...BRAND_KINDS] }, isActive: true }, orderBy: { sortOrder: "asc" } }),
      getMarketingConfig(app.prisma),
    ]);
    return { success: true, data: products.map((p) => ({ ...p, price: Number(p.price), gstPercent })) };
  });

  app.get<{ Querystring: { productId?: string; quantity?: string; startsAt?: string; categoryId?: string; excludeId?: string } }>("/availability", opts, async (request, reply) => {
    const q = request.query;
    const product = q.productId ? await app.prisma.adProduct.findUnique({ where: { id: q.productId } }) : null;
    const start = new Date(q.startsAt ?? "");
    if (!product?.placement || Number.isNaN(start.getTime())) return reply.badRequest("Choose a package and a start date");
    const window = windowFor(product, Math.max(Number(q.quantity) || 1, 1), start);
    const slot = await availability(app.prisma, { placement: product.placement, categoryId: q.categoryId, ...window, excludeId: q.excludeId });
    return { success: true, data: { ...slot, ...window } };
  });

  app.get<{ Querystring: { status?: string; brandId?: string } }>("/", opts, async (request) => {
    const brandId = (await scope.brandOf(request)) ?? request.query.brandId;
    const rows = await app.prisma.brandCampaign.findMany({
      where: { ...(brandId ? { brandId } : {}), ...(request.query.status ? { status: request.query.status as BrandCampaignStatus } : {}) },
      orderBy: { startsAt: "desc" }, take: 200, include: DETAIL_INCLUDE,
    });
    return { success: true, data: rows.map(listRow) };
  });

  app.get<{ Params: { id: string } }>("/:id", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    return campaign && { success: true, data: await detail(campaign.id) };
  });

  app.get<{ Params: { id: string } }>("/:id/claims.csv", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    reply.header("content-disposition", `attachment; filename="claims-${campaign.id.slice(0, 8)}.csv"`);
    return reply.type("text/csv; charset=utf-8").send(await claimsCsv(app.prisma, campaign));
  });
}

function bookingRoutes(app: FastifyInstance, scope: CampaignScope, { load, detail, opts }: ReturnType<typeof campaignContext>) {
  app.post("/", opts, async (request, reply) => {
    const brandId = await scope.brandOf(request);
    const input = brandCampaignSchema.parse({ ...(request.body as object), ...(brandId ? { brandId } : {}) });
    const campaign = await createCampaign(app.prisma, input, getOrgUser(request).sub);
    return reply.code(201).send({ success: true, data: await detail(campaign.id) });
  });

  app.put<{ Params: { id: string } }>("/:id", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    await updateCampaign(app.prisma, campaign, brandCampaignSchema.parse({ ...(request.body as object), brandId: campaign.brandId }));
    return { success: true, data: await detail(campaign.id) };
  });

  app.post<{ Params: { id: string } }>("/:id/generate-art", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    await generateCampaignArt(app.prisma, campaign, request.log);
    return { success: true, data: await detail(campaign.id) };
  });

  app.post<{ Params: { id: string } }>("/:id/cancel", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    await cancelCampaign(app.prisma, campaign);
    return { success: true, data: await detail(campaign.id) };
  });
}

function paymentRoutes(app: FastifyInstance, { load, detail, opts }: ReturnType<typeof campaignContext>) {
  app.post<{ Params: { id: string } }>("/:id/checkout", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign) return;
    const b = billingProfileSchema.parse(request.body);
    const billing = { name: b.billingName, gstin: b.gstin || null, address: b.billingAddress, state: b.billingState };
    const { order, checkout } = await checkoutCampaign(app.prisma, campaign, billing, getOrgUser(request).sub);
    return { success: true, data: { orderId: order.id, total: Number(order.total), checkout } };
  });

  app.post<{ Params: { id: string } }>("/:id/verify", opts, async (request, reply) => {
    const campaign = await load(request, reply);
    if (!campaign?.adOrderId) return campaign && reply.badRequest("Nothing to pay for");
    const body = verifyAdPaymentSchema.parse(request.body);
    const order = await app.prisma.adOrder.findUniqueOrThrow({ where: { id: campaign.adOrderId } });
    if (order.razorpayOrderId !== body.razorpay_order_id || !verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return reply.badRequest("Payment could not be verified");
    }
    await fulfilAdOrder(app.prisma, order.id, { paymentId: body.razorpay_payment_id }, app.fcm);
    return { success: true, data: await detail(campaign.id) };
  });
}

/** Booking, paying for and following brand campaigns, shared by the Martly team and the brand portal */
export function campaignRoutes(scope: CampaignScope) {
  return async function (app: FastifyInstance) {
    const ctx = campaignContext(app, scope);
    readRoutes(app, scope, ctx);
    bookingRoutes(app, scope, ctx);
    paymentRoutes(app, ctx);
  };
}
