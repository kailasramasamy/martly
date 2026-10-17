import type { FastifyInstance } from "fastify";
import { verifyRazorpayWebhook } from "../../services/payment.js";
import { fulfilAdOrder } from "../../services/marketing/billing.js";
import { recordSubscriptionCharge, updateSubscriptionStatus } from "../../services/marketing/subscriptions.js";
import { notifyOwners } from "../../services/marketing/renewals.js";

interface RazorpayEvent {
  event: string;
  payload?: {
    order?: { entity?: { id?: string } };
    payment?: { entity?: { id?: string; amount?: number } };
    subscription?: { entity?: { id?: string; notes?: { organizationId?: string } } };
  };
}

const SUBSCRIPTION_STATUS = {
  "subscription.activated": "ACTIVE",
  "subscription.pending": "PENDING",
  "subscription.halted": "HALTED",
  "subscription.cancelled": "CANCELLED",
  "subscription.completed": "COMPLETED",
} as const;

/**
 * Razorpay calls this when an order is paid or a plan subscription is charged or changes state, so purchases
 * complete even if the app closed before verifying.
 * The signature covers the raw body, so this scope keeps JSON bodies as text.
 */
async function onOrderPaid(app: FastifyInstance, event: RazorpayEvent) {
  const razorpayOrderId = event.payload?.order?.entity?.id;
  if (event.event !== "order.paid" || !razorpayOrderId) return;
  // Customer orders and wallet top-ups also raise order.paid; only marketing orders are settled here
  const order = await app.prisma.adOrder.findUnique({ where: { razorpayOrderId }, select: { id: true } });
  if (order) await fulfilAdOrder(app.prisma, order.id, { paymentId: event.payload?.payment?.entity?.id });
}

/** Monthly plan charges and subscription state changes; a halted one (payments failing) is told to the owners */
async function onSubscriptionEvent(app: FastifyInstance, event: RazorpayEvent) {
  const subscriptionId = event.payload?.subscription?.entity?.id;
  const payment = event.payload?.payment?.entity;
  if (!subscriptionId) return;
  if (event.event === "subscription.charged" && payment?.id && payment.amount) {
    await recordSubscriptionCharge(app.prisma, subscriptionId, { id: payment.id, amount: payment.amount });
    return;
  }
  const status = SUBSCRIPTION_STATUS[event.event as keyof typeof SUBSCRIPTION_STATUS];
  if (!status || !(await updateSubscriptionStatus(app.prisma, subscriptionId, status))) return;
  const organizationId = event.payload?.subscription?.entity?.notes?.organizationId;
  if (status === "HALTED" && organizationId) {
    await notifyOwners(app.fcm, app.prisma, organizationId, "Your plan's renewal payment failed",
      "Update your payment method in Marketing plan; your plan stays active until the end of the paid month.");
  }
}

export async function paymentWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => done(null, body));

  app.post("/razorpay", async (request, reply) => {
    const raw = request.body as string;
    const signature = request.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !verifyRazorpayWebhook(raw, signature)) return reply.unauthorized("Bad signature");
    const event = JSON.parse(raw) as RazorpayEvent;
    if (event.event.startsWith("subscription.")) await onSubscriptionEvent(app, event);
    else await onOrderPaid(app, event);
    return { received: true };
  });
}
