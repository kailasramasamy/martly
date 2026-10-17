import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { verifySubscriptionSignature } from "../../services/payment.js";
import { getEntitlements } from "../../services/marketing/entitlements.js";
import { cancelSubscription, recordSubscriptionCharge, startSubscription, startTrial } from "../../services/marketing/subscriptions.js";

const owner = { preHandler: [authenticate, requireRole("ORG_ADMIN")] };
const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** Store plans that renew monthly, and the one-time free trial */
export async function subscriptionRoutes(app: FastifyInstance) {
  const entitlements = (organizationId: string) => getEntitlements(app.prisma, organizationId);

  app.post("/subscription", owner, async (request, reply) => {
    const { productId } = z.object({ productId: z.string().uuid() }).parse(request.body);
    const user = getOrgUser(request);
    const [product, org] = await Promise.all([
      app.prisma.adProduct.findUnique({ where: { id: productId } }),
      app.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId! } }),
    ]);
    if (!product) return reply.notFound("Plan not found");
    if (!org.billingName || !org.billingAddress || !org.billingState) return reply.badRequest("Add your billing details before paying");
    const checkout = await startSubscription(app.prisma, org.id, product, user.sub);
    return reply.code(201).send({ success: true, data: checkout });
  });

  // The checkout's handler after the mandate is authorised (and, unless billing starts later, the first charge made)
  app.post("/subscription/verify", owner, async (request, reply) => {
    const body = verifySchema.parse(request.body);
    const organizationId = getOrgUser(request).organizationId!;
    const sub = await app.prisma.marketingSubscription.findFirst({
      where: { razorpaySubscriptionId: body.razorpay_subscription_id, organizationId }, include: { product: true },
    });
    if (!sub || !verifySubscriptionSignature(body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature)) {
      return reply.badRequest("Payment could not be verified");
    }
    // A plan that starts later was only authorised now; its first charge arrives by webhook when it starts
    if (!sub.startAt) {
      await recordSubscriptionCharge(app.prisma, sub.razorpaySubscriptionId, { id: body.razorpay_payment_id, amount: sub.product.razorpayPlanAmount ?? 0 });
    }
    return { success: true, data: await entitlements(organizationId) };
  });

  app.post("/subscription/cancel", owner, async (request) => {
    const organizationId = getOrgUser(request).organizationId!;
    await cancelSubscription(app.prisma, organizationId);
    return { success: true, data: await entitlements(organizationId) };
  });

  app.post("/trial", owner, async (request) => {
    const organizationId = getOrgUser(request).organizationId!;
    await startTrial(app.prisma, organizationId);
    return { success: true, data: await entitlements(organizationId) };
  });
}
