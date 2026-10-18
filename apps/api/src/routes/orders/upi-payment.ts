import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { createUpiIntentPayment, findCapturedPayment, isUpiS2SEnabled } from "../../services/payment.js";
import { prepareOrderPayment, settleOrderPayment } from "../../services/order-payment.js";

/** UPI-intent checkout: our server starts the payment, the app opens the UPI app and then polls for the result */
export async function upiPaymentRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/:id/payment/upi-intent",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!isUpiS2SEnabled()) return reply.badRequest("UPI intent payments are not enabled");
      const user = request.user as { sub: string };
      const { rpOrderId, amountInPaise, customerId } = await prepareOrderPayment(app, request.params.id, user.sub);
      const customer = await app.prisma.user.findUniqueOrThrow({
        where: { id: user.sub },
        select: { phone: true, email: true },
      });
      if (!customer.phone) return reply.badRequest("Add a phone number to pay with UPI");

      const { link } = await createUpiIntentPayment({
        razorpayOrderId: rpOrderId,
        amountInPaise,
        contact: customer.phone,
        email: customer.email,
        customerId,
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? "Martly",
      });

      const response: ApiResponse<{ link: string; razorpay_order_id: string }> = {
        success: true,
        data: { link, razorpay_order_id: rpOrderId },
      };
      return response;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/payment/status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const order = await app.prisma.order.findUnique({ where: { id: request.params.id } });
      if (!order) return reply.notFound("Order not found");
      const user = request.user as { sub: string };
      if (order.userId !== user.sub) return reply.forbidden("Access denied");

      let paymentStatus = order.paymentStatus;
      if (paymentStatus !== "PAID" && order.razorpayOrderId) {
        const paymentId = await findCapturedPayment(order.razorpayOrderId);
        if (paymentId) paymentStatus = (await settleOrderPayment(app, order.id, paymentId)).paymentStatus;
      }

      const response: ApiResponse<{ paymentStatus: string }> = { success: true, data: { paymentStatus } };
      return response;
    },
  );
}
