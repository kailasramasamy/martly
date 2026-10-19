import type { FastifyInstance } from "fastify";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { STAFF_NOTIFICATION_TYPES, type NotificationAudience } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import type { NotificationType } from "../../../generated/prisma/index.js";

const MAX_PAGE_SIZE = 50;
const staffTypes = STAFF_NOTIFICATION_TYPES as NotificationType[];

/** Staff alerts and shopper notifications share a table; each inbox shows its own */
function audienceFilter(audience?: string) {
  if (audience === "staff") return { type: { in: staffTypes } };
  if (audience === "customer") return { type: { notIn: staffTypes } };
  return {};
}

/** A signed-in user's own inbox: list, unread counts, mark read */
export async function notificationInboxRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const query = request.query as { page?: number; pageSize?: number; audience?: NotificationAudience };
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize ?? 20)));
    const where = { userId: user.sub, ...audienceFilter(query.audience) };

    const [notifications, total] = await Promise.all([
      app.prisma.notification.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
      app.prisma.notification.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof notifications)[0]> = {
      success: true,
      data: notifications,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
    return response;
  });

  // Both badges in one call: the Home bell shows `customer`, the Manage bell `staff`
  app.get("/unread-count", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const [staff, customer] = await Promise.all([
      app.prisma.notification.count({ where: { userId: user.sub, isRead: false, ...audienceFilter("staff") } }),
      app.prisma.notification.count({ where: { userId: user.sub, isRead: false, ...audienceFilter("customer") } }),
    ]);
    const response: ApiResponse<{ count: number; staff: number; customer: number }> = {
      success: true,
      data: { count: staff + customer, staff, customer },
    };
    return response;
  });

  app.patch<{ Params: { id: string } }>("/:id/read", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const notification = await app.prisma.notification.findUnique({ where: { id: request.params.id } });
    if (!notification) return reply.notFound("Notification not found");
    if (notification.userId !== user.sub) return reply.forbidden("Access denied");

    const updated = await app.prisma.notification.update({ where: { id: request.params.id }, data: { isRead: true } });
    const response: ApiResponse<typeof updated> = { success: true, data: updated };
    return response;
  });

  app.patch("/read-all", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const { audience } = request.query as { audience?: NotificationAudience };
    const result = await app.prisma.notification.updateMany({
      where: { userId: user.sub, isRead: false, ...audienceFilter(audience) },
      data: { isRead: true },
    });
    const response: ApiResponse<{ updated: number }> = { success: true, data: { updated: result.count } };
    return response;
  });
}
