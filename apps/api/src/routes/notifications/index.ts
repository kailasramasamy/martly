import type { FastifyInstance } from "fastify";
import { sendPromotionalNotificationSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { broadcastNotification } from "../../services/ws-manager.js";

export async function notificationRoutes(app: FastifyInstance) {
  // GET /notifications — Customer: paginated list
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where = { userId: user.sub };

    const [notifications, total] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
      }),
      app.prisma.notification.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof notifications)[0]> = {
      success: true,
      data: notifications,
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
    return response;
  });

  // GET /notifications/unread-count — Customer: badge count
  app.get("/unread-count", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);

    const count = await app.prisma.notification.count({
      where: { userId: user.sub, isRead: false },
    });

    const response: ApiResponse<{ count: number }> = {
      success: true,
      data: { count },
    };
    return response;
  });

  // PATCH /notifications/:id/read — Mark single as read
  app.patch<{ Params: { id: string } }>(
    "/:id/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = getOrgUser(request);

      const notification = await app.prisma.notification.findUnique({
        where: { id: request.params.id },
      });
      if (!notification) return reply.notFound("Notification not found");
      if (notification.userId !== user.sub) return reply.forbidden("Access denied");

      const updated = await app.prisma.notification.update({
        where: { id: request.params.id },
        data: { isRead: true },
      });

      const response: ApiResponse<typeof updated> = { success: true, data: updated };
      return response;
    },
  );

  // PATCH /notifications/read-all — Mark all as read
  app.patch("/read-all", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);

    const result = await app.prisma.notification.updateMany({
      where: { userId: user.sub, isRead: false },
      data: { isRead: true },
    });

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      data: { updated: result.count },
    };
    return response;
  });

  // POST /notifications/send — Admin: send notification to org customers
  app.post(
    "/send",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const admin = getOrgUser(request);
      const body = sendPromotionalNotificationSchema.parse(request.body);

      let orgId = admin.organizationId;
      if (!orgId && admin.role !== "SUPER_ADMIN") {
        return reply.forbidden("Organization context required");
      }

      // Find target customers: those who have ordered from this org's stores
      const storeWhere: Record<string, unknown> = {};
      if (orgId) storeWhere.organizationId = orgId;
      if (body.storeId) storeWhere.id = body.storeId;

      const storeIds = await app.prisma.store.findMany({
        where: storeWhere,
        select: { id: true },
      });

      if (storeIds.length === 0) {
        return reply.badRequest("No stores found for this organization");
      }

      // Get distinct customer userIds who have ordered from these stores
      const orders = await app.prisma.order.findMany({
        where: { storeId: { in: storeIds.map((s) => s.id) } },
        select: { userId: true },
        distinct: ["userId"],
      });

      const userIds = orders.map((o) => o.userId);
      if (userIds.length === 0) {
        const response: ApiResponse<{ sent: number }> = {
          success: true,
          data: { sent: 0 },
        };
        return response;
      }

      // Build deep link data from optional fields
      const notifData: Record<string, unknown> = {};
      if (body.storeId) notifData.storeId = body.storeId;
      if (body.deepLinkType && body.deepLinkId) {
        const keyMap = { product: "productId", category: "categoryId", store: "storeId", screen: "screen" } as const;
        notifData[keyMap[body.deepLinkType]] = body.deepLinkId;
      }

      // Create notifications for all target users and broadcast via WebSocket
      const notifications = await Promise.all(
        userIds.map((userId) =>
          app.prisma.notification.create({
            data: {
              userId,
              type: body.type,
              title: body.title,
              body: body.body,
              imageUrl: body.imageUrl,
              data: Object.keys(notifData).length > 0 ? notifData : undefined,
            },
          }),
        ),
      );

      // Broadcast via WebSocket to each user
      for (const notification of notifications) {
        broadcastNotification(notification.userId, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
          data: notification.data,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        });
      }

      // Send FCM push (fire-and-forget, DB records already created above)
      if (app.fcm) {
        const allTokens = await app.prisma.deviceToken.findMany({
          where: { userId: { in: userIds } },
          select: { token: true },
        });
        if (allTokens.length > 0) {
          app.fcm.sendEachForMulticast({
            tokens: allTokens.map((t) => t.token),
            notification: { title: body.title, body: body.body },
          }).catch(() => {});
        }
      }

      const response: ApiResponse<{ sent: number }> = {
        success: true,
        data: { sent: userIds.length },
      };
      return response;
    },
  );
}
