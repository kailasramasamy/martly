import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { billingProfileSchema, createAdOrderSchema, verifyAdPaymentSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { verifyRazorpaySignature } from "../../services/payment.js";
import { getEntitlements } from "../../services/marketing/entitlements.js";
import { getMarketingConfig } from "../../services/marketing/config.js";
import { createAdOrder, fulfilAdOrder } from "../../services/marketing/billing.js";
import { invoiceLink, invoiceLinkValid, renderInvoice } from "../../services/marketing/invoice.js";
import { bannerResults, promoSales } from "../../services/marketing/stats.js";
import { brandAdRoutes } from "./brand-ads.js";

const STORE_KINDS = ["STORE_PLAN", "PROMOTION_TOPUP"] as const;
const staff = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };
const owner = { preHandler: [authenticate, requireRole("ORG_ADMIN")] };

/** The organisation a request acts for; the platform admin names one with ?organizationId */
export function orgOf(request: FastifyRequest, reply: FastifyReply): string | undefined {
  const user = getOrgUser(request);
  const organizationId = user.role === "SUPER_ADMIN" ? (request.query as { organizationId?: string }).organizationId : user.organizationId;
  if (!organizationId) reply.badRequest("Choose an organisation");
  return organizationId;
}

/** Store owners' paid marketing: plan, usage, purchases, invoices and results */
export async function marketingRoutes(app: FastifyInstance) {
  await app.register(brandAdRoutes);

  app.get("/entitlements", staff, async (request, reply) => {
    const organizationId = orgOf(request, reply);
    if (!organizationId) return;
    return { success: true, data: await getEntitlements(app.prisma, organizationId) };
  });

  app.get("/products", staff, async () => {
    const [products, { gstPercent }] = await Promise.all([
      app.prisma.adProduct.findMany({ where: { kind: { in: [...STORE_KINDS] }, isActive: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
      getMarketingConfig(app.prisma),
    ]);
    return { success: true, data: products.map((p) => ({ ...p, price: Number(p.price), gstPercent })) };
  });

  app.get("/billing-profile", staff, async (request, reply) => {
    const organizationId = orgOf(request, reply);
    if (!organizationId) return;
    const org = await app.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId }, select: { name: true, billingName: true, gstin: true, billingAddress: true, billingState: true },
    });
    return { success: true, data: { ...org, billingName: org.billingName ?? org.name } };
  });

  app.put("/billing-profile", owner, async (request) => {
    const body = billingProfileSchema.parse(request.body);
    const org = await app.prisma.organization.update({
      where: { id: getOrgUser(request).organizationId! },
      data: { ...body, gstin: body.gstin || null },
      select: { name: true, billingName: true, gstin: true, billingAddress: true, billingState: true },
    });
    return { success: true, data: org };
  });

  app.post("/orders", owner, async (request, reply) => {
    const { productId, quantity } = createAdOrderSchema.parse(request.body);
    const user = getOrgUser(request);
    const [product, org] = await Promise.all([
      app.prisma.adProduct.findUnique({ where: { id: productId } }),
      app.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId! } }),
    ]);
    if (!product || !(STORE_KINDS as readonly string[]).includes(product.kind)) return reply.notFound("Package not found");
    if (!org.billingName || !org.billingAddress || !org.billingState) return reply.badRequest("Add your billing details before paying");
    const billing = { name: org.billingName, gstin: org.gstin, address: org.billingAddress, state: org.billingState };
    const { order, checkout } = await createAdOrder(app.prisma, product, quantity, { organizationId: org.id, billing, createdById: user.sub });
    return reply.code(201).send({ success: true, data: { orderId: order.id, total: Number(order.total), checkout } });
  });

  app.post<{ Params: { id: string } }>("/orders/:id/verify", owner, async (request, reply) => {
    const body = verifyAdPaymentSchema.parse(request.body);
    const order = await app.prisma.adOrder.findFirst({ where: { id: request.params.id, organizationId: getOrgUser(request).organizationId } });
    if (!order) return reply.notFound("Order not found");
    if (order.razorpayOrderId !== body.razorpay_order_id || !verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return reply.badRequest("Payment could not be verified");
    }
    const paid = await fulfilAdOrder(app.prisma, order.id, { paymentId: body.razorpay_payment_id });
    return { success: true, data: { status: paid.status, number: paid.number } };
  });

  app.get("/orders", staff, async (request, reply) => {
    const organizationId = orgOf(request, reply);
    if (!organizationId) return;
    const orders = await app.prisma.adOrder.findMany({
      where: { organizationId, status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 100,
      include: { product: { select: { name: true, kind: true } } },
    });
    return {
      success: true,
      data: orders.map((o) => ({
        id: o.id, number: o.number, product: o.product, quantity: o.quantity, total: Number(o.total), status: o.status, paidAt: o.paidAt,
        invoiceUrl: o.number ? invoiceLink(o.id) : null,
      })),
    };
  });

  // Opened in a browser from a signed link, so it carries no auth header
  app.get<{ Params: { id: string }; Querystring: { expires?: string; sig?: string } }>("/invoices/:id", async (request, reply) => {
    if (!invoiceLinkValid(request.params.id, Number(request.query.expires), request.query.sig ?? "")) return reply.forbidden("This invoice link has expired");
    const html = await renderInvoice(app.prisma, request.params.id);
    if (!html) return reply.notFound("Invoice not found");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get<{ Querystring: { days?: string } }>("/results", staff, async (request, reply) => {
    const organizationId = orgOf(request, reply);
    if (!organizationId) return;
    const days = Math.min(Math.max(Number(request.query.days) || 30, 1), 180);
    const [banners, promos] = await Promise.all([
      bannerResults(app.prisma, { organizationId, sponsorType: "STORE" }, days),
      app.prisma.promo.findMany({
        where: { organizationId, status: { in: ["LIVE", "ENDED"] } }, orderBy: { startsAt: "desc" }, take: 20,
        select: { id: true, brief: true, status: true, organizationId: true, collectionId: true, startsAt: true, endsAt: true, copy: true },
      }),
    ]);
    const sales = await Promise.all(promos.map((p) => promoSales(app.prisma, p)));
    return {
      success: true,
      data: {
        days, banners,
        promotions: promos.map((p, i) => ({ id: p.id, brief: p.brief, status: p.status, startsAt: p.startsAt, endsAt: p.endsAt, copy: p.copy, ...sales[i] })),
      },
    };
  });
}
