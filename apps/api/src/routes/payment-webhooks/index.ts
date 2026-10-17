import type { FastifyInstance } from "fastify";
import { verifyRazorpayWebhook } from "../../services/payment.js";
import { fulfilAdOrder } from "../../services/marketing/billing.js";

interface RazorpayEvent {
  event: string;
  payload?: { order?: { entity?: { id?: string } }; payment?: { entity?: { id?: string } } };
}

/**
 * Razorpay calls this when an order is paid, so a purchase completes even if the app closed before verifying.
 * The signature covers the raw body, so this scope keeps JSON bodies as text.
 */
export async function paymentWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => done(null, body));

  app.post("/razorpay", async (request, reply) => {
    const raw = request.body as string;
    const signature = request.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !verifyRazorpayWebhook(raw, signature)) return reply.unauthorized("Bad signature");
    const event = JSON.parse(raw) as RazorpayEvent;
    const razorpayOrderId = event.payload?.order?.entity?.id;
    const paymentId = event.payload?.payment?.entity?.id;
    if (event.event !== "order.paid" || !razorpayOrderId) return { received: true };
    // Customer orders and wallet top-ups also raise order.paid; only marketing orders are settled here
    const order = await app.prisma.adOrder.findUnique({ where: { razorpayOrderId }, select: { id: true } });
    if (order) await fulfilAdOrder(app.prisma, order.id, { paymentId });
    return { received: true };
  });
}
