import type { FastifyInstance } from "fastify";
import { undoDeliverySchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { undoDelivery, undoDenial } from "../../services/order-undo.js";
import { broadcastOrderUpdate } from "../../services/order-broadcast.js";
import { sendNotification } from "../../services/notification.js";

/** Undo a delivery marked by mistake: reverses stock, COD payment, loyalty and the trip, then moves the order back a step */
export async function undoDeliveryRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/:id/undo-delivery",
    { preHandler: [authenticate, requirePermission(Permission.ORDERS_CANCEL)] },
    async (request, reply) => {
      const { reason } = undoDeliverySchema.parse(request.body);
      const order = await app.prisma.order.findUnique({
        where: { id: request.params.id },
        include: { statusLogs: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } } },
      });
      if (!order) return reply.notFound("Order not found");
      if (!(await verifyStoreOrgAccess(request, app.prisma, order.storeId))) return reply.forbidden("Access denied");
      const denied = await undoDenial(app.prisma, order);
      if (denied) return reply.conflict(denied);

      const status = await app.prisma.$transaction((tx) => undoDelivery(tx, order, { userId: request.user.sub, reason }));

      broadcastOrderUpdate(app.prisma, order.id, status);
      sendNotification(app.fcm, app.prisma, {
        userId: order.userId,
        type: status === "READY" ? "ORDER_READY" : "ORDER_OUT_FOR_DELIVERY",
        title: "Order status corrected",
        body: status === "READY"
          ? `Order #${order.id.slice(0, 8)} was marked collected by mistake. It's still ready for pickup.`
          : `Order #${order.id.slice(0, 8)} was marked delivered by mistake. It's still on its way.`,
        data: { orderId: order.id, status },
      });

      const response: ApiResponse<{ id: string; status: string }> = { success: true, data: { id: order.id, status } };
      return response;
    },
  );
}
