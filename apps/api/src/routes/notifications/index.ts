import type { FastifyInstance } from "fastify";
import {
  sendNotificationSchema,
  sendCampaignSchema,
  audiencePreviewSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { broadcastNotification } from "../../services/ws-manager.js";
import { resolveAudience } from "../../services/audience-resolver.js";
import { sendCampaignNotifications } from "../../services/notification.js";
import type { AudienceType, NotificationType } from "../../../generated/prisma/index.js";

export async function notificationRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════
  // CUSTOMER ENDPOINTS (unchanged)
  // ═══════════════════════════════════════════════════════

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

  // POST /notifications/send — Backward compat: creates campaign internally
  app.post(
    "/send",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const admin = getOrgUser(request);
      const body = sendNotificationSchema.parse(request.body);

      let orgId = admin.organizationId;
      if (!orgId && admin.role !== "SUPER_ADMIN") {
        return reply.forbidden("Organization context required");
      }

      // For SUPER_ADMIN without org, we need at least some org context
      if (!orgId) {
        // Find org from storeId or pick first org
        if (body.storeId) {
          const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
          orgId = store?.organizationId;
        }
        if (!orgId) {
          const firstOrg = await app.prisma.organization.findFirst({ select: { id: true } });
          orgId = firstOrg?.id;
        }
        if (!orgId) return reply.badRequest("No organization found");
      }

      // Resolve audience
      const userIds = await resolveAudience(app.prisma, orgId, "ALL_CUSTOMERS", body.storeId ? { storeId: body.storeId } : undefined);

      if (userIds.length === 0) {
        const response: ApiResponse<{ sent: number }> = { success: true, data: { sent: 0 } };
        return response;
      }

      // Build deep link data
      const notifData: Record<string, unknown> = {};
      if (body.storeId) notifData.storeId = body.storeId;
      if (body.deepLinkType && body.deepLinkId) {
        const keyMap = { product: "productId", category: "categoryId", store: "storeId", screen: "screen" } as const;
        notifData[keyMap[body.deepLinkType]] = body.deepLinkId;
      }

      // Create campaign record
      const campaign = await app.prisma.notificationCampaign.create({
        data: {
          organizationId: orgId,
          title: body.title,
          body: body.body,
          type: body.type as NotificationType,
          imageUrl: body.imageUrl,
          data: Object.keys(notifData).length > 0 ? (notifData as any) : undefined,
          audienceType: body.storeId ? "STORE_CUSTOMERS" : "ALL_CUSTOMERS",
          audienceConfig: body.storeId ? ({ storeId: body.storeId } as any) : undefined,
          status: "SENT",
          recipientCount: userIds.length,
          sentAt: new Date(),
          sentBy: admin.sub,
        },
      });

      // Send notifications
      await sendCampaignNotifications(app.fcm, app.prisma, campaign.id, userIds, {
        type: body.type as NotificationType,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl,
        data: Object.keys(notifData).length > 0 ? (notifData as any) : undefined,
      });

      const response: ApiResponse<{ sent: number; campaignId: string }> = {
        success: true,
        data: { sent: userIds.length, campaignId: campaign.id },
      };
      return response;
    },
  );

  // ═══════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════

  const adminPreHandler = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")];

  // Helper to get org ID for admin
  function getAdminOrgId(request: Parameters<typeof getOrgUser>[0]) {
    const user = getOrgUser(request);
    return { user, orgId: user.organizationId };
  }

  // ── Stats Dashboard ──────────────────────────────────
  app.get("/admin/stats", { preHandler: adminPreHandler }, async (request, reply) => {
    const { user, orgId } = getAdminOrgId(request);
    if (!orgId && user.role !== "SUPER_ADMIN") return reply.forbidden("Organization context required");

    const { days = "30" } = request.query as { days?: string };
    const daysNum = Number(days);
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const orgFilter = orgId ? { organizationId: orgId } : {};

    // KPI stats
    const [campaignCount, totalNotifications, readNotifications, campaigns] = await Promise.all([
      app.prisma.notificationCampaign.count({
        where: { ...orgFilter, status: "SENT", sentAt: { gte: since } },
      }),
      app.prisma.notification.count({
        where: { campaign: { ...orgFilter, status: "SENT" }, createdAt: { gte: since } },
      }),
      app.prisma.notification.count({
        where: { campaign: { ...orgFilter, status: "SENT" }, createdAt: { gte: since }, isRead: true },
      }),
      app.prisma.notificationCampaign.findMany({
        where: { ...orgFilter, status: "SENT", sentAt: { gte: since } },
        select: { recipientCount: true },
      }),
    ]);

    const avgRecipients = campaigns.length > 0
      ? Math.round(campaigns.reduce((sum, c) => sum + c.recipientCount, 0) / campaigns.length)
      : 0;

    const readRate = totalNotifications > 0 ? Math.round((readNotifications / totalNotifications) * 100) : 0;

    // Daily send counts for chart
    const dailyCampaigns = await app.prisma.notificationCampaign.groupBy({
      by: ["sentAt"],
      where: { ...orgFilter, status: "SENT", sentAt: { gte: since, not: null } },
      _count: true,
      _sum: { recipientCount: true },
    });

    // Aggregate by date
    const dailyMap = new Map<string, { campaigns: number; notifications: number }>();
    for (const row of dailyCampaigns) {
      if (!row.sentAt) continue;
      const dateKey = row.sentAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey) || { campaigns: 0, notifications: 0 };
      existing.campaigns += row._count;
      existing.notifications += row._sum.recipientCount ?? 0;
      dailyMap.set(dateKey, existing);
    }
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // By type breakdown
    const byType = await app.prisma.notificationCampaign.groupBy({
      by: ["type"],
      where: { ...orgFilter, status: "SENT", sentAt: { gte: since } },
      _count: true,
      _sum: { recipientCount: true },
    });

    // Top campaigns by read rate
    const topCampaigns = await app.prisma.notificationCampaign.findMany({
      where: { ...orgFilter, status: "SENT", sentAt: { gte: since }, recipientCount: { gt: 0 } },
      orderBy: { recipientCount: "desc" },
      take: 5,
      include: {
        _count: { select: { notifications: true } },
      },
    });

    // Enrich with read counts
    const topCampaignsWithStats = await Promise.all(
      topCampaigns.map(async (c) => {
        const readCount = await app.prisma.notification.count({
          where: { campaignId: c.id, isRead: true },
        });
        return {
          id: c.id,
          title: c.title,
          type: c.type,
          audienceType: c.audienceType,
          recipientCount: c.recipientCount,
          readCount,
          readRate: c.recipientCount > 0 ? Math.round((readCount / c.recipientCount) * 100) : 0,
          sentAt: c.sentAt,
        };
      }),
    );

    // Recent campaigns
    const recentCampaigns = await app.prisma.notificationCampaign.findMany({
      where: { ...orgFilter },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        audienceType: true,
        status: true,
        recipientCount: true,
        sentAt: true,
        createdAt: true,
      },
    });

    const response: ApiResponse<any> = {
      success: true,
      data: {
        kpis: {
          campaignsSent: campaignCount,
          notificationsDelivered: totalNotifications,
          readRate,
          avgRecipients,
        },
        dailyStats,
        byType: byType.map((t) => ({
          type: t.type,
          count: t._count,
          notifications: t._sum.recipientCount ?? 0,
        })),
        topCampaigns: topCampaignsWithStats,
        recentCampaigns,
      },
    };
    return response;
  });

  // ── Campaign List ────────────────────────────────────
  app.get("/admin/campaigns", { preHandler: adminPreHandler }, async (request, reply) => {
    const { user, orgId } = getAdminOrgId(request);
    if (!orgId && user.role !== "SUPER_ADMIN") return reply.forbidden("Organization context required");

    const { page = "1", pageSize = "10", type, q, from, to } = request.query as {
      page?: string;
      pageSize?: string;
      type?: string;
      q?: string;
      from?: string;
      to?: string;
    };

    const skip = (Number(page) - 1) * Number(pageSize);
    const where: Record<string, any> = {};
    if (orgId) where.organizationId = orgId;
    if (type) where.type = type;
    if (q) where.title = { contains: q, mode: "insensitive" };
    if (from || to) {
      where.sentAt = {};
      if (from) where.sentAt.gte = new Date(from);
      if (to) where.sentAt.lte = new Date(to);
    }

    const [campaigns, total] = await Promise.all([
      app.prisma.notificationCampaign.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: {
          sentByUser: { select: { name: true } },
          _count: { select: { notifications: true } },
        },
      }),
      app.prisma.notificationCampaign.count({ where }),
    ]);

    // Enrich with read counts
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const readCount = await app.prisma.notification.count({
          where: { campaignId: c.id, isRead: true },
        });
        return {
          ...c,
          readCount,
          readRate: c.recipientCount > 0 ? Math.round((readCount / c.recipientCount) * 100) : 0,
        };
      }),
    );

    const response: PaginatedResponse<(typeof enriched)[0]> = {
      success: true,
      data: enriched,
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
    return response;
  });

  // ── Campaign Detail ──────────────────────────────────
  app.get<{ Params: { id: string } }>("/admin/campaigns/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    const { user, orgId } = getAdminOrgId(request);

    const campaign = await app.prisma.notificationCampaign.findUnique({
      where: { id: request.params.id },
      include: {
        sentByUser: { select: { name: true, email: true } },
        _count: { select: { notifications: true } },
      },
    });

    if (!campaign) return reply.notFound("Campaign not found");
    if (orgId && campaign.organizationId !== orgId) return reply.forbidden("Access denied");

    const readCount = await app.prisma.notification.count({
      where: { campaignId: campaign.id, isRead: true },
    });

    const response: ApiResponse<any> = {
      success: true,
      data: {
        ...campaign,
        readCount,
        readRate: campaign.recipientCount > 0 ? Math.round((readCount / campaign.recipientCount) * 100) : 0,
      },
    };
    return response;
  });

  // ── Send Campaign ────────────────────────────────────
  app.post("/admin/send", { preHandler: adminPreHandler }, async (request, reply) => {
    const admin = getOrgUser(request);
    const body = sendCampaignSchema.parse(request.body);

    let orgId = admin.organizationId;
    if (!orgId && admin.role !== "SUPER_ADMIN") {
      return reply.forbidden("Organization context required");
    }
    if (!orgId) {
      const firstOrg = await app.prisma.organization.findFirst({ select: { id: true } });
      orgId = firstOrg?.id;
      if (!orgId) return reply.badRequest("No organization found");
    }

    // Build deep link data
    const notifData: Record<string, unknown> = {};
    if (body.deepLinkType && body.deepLinkId) {
      const keyMap = { product: "productId", category: "categoryId", store: "storeId", screen: "screen" } as const;
      notifData[keyMap[body.deepLinkType]] = body.deepLinkId;
    }

    // Check if scheduling
    const isScheduled = body.scheduledAt && new Date(body.scheduledAt) > new Date();

    if (isScheduled) {
      // Create as SCHEDULED campaign
      const campaign = await app.prisma.notificationCampaign.create({
        data: {
          organizationId: orgId,
          title: body.title,
          body: body.body,
          type: body.type as NotificationType,
          imageUrl: body.imageUrl,
          data: Object.keys(notifData).length > 0 ? (notifData as any) : undefined,
          audienceType: body.audienceType as AudienceType,
          audienceConfig: body.audienceConfig as any,
          status: "SCHEDULED",
          scheduledAt: body.scheduledAt,
          sentBy: admin.sub,
        },
      });

      const response: ApiResponse<{ campaignId: string; status: string; scheduledAt: Date }> = {
        success: true,
        data: { campaignId: campaign.id, status: "SCHEDULED", scheduledAt: campaign.scheduledAt! },
      };
      return response;
    }

    // Immediate send: resolve audience, create as SENDING, process in background
    const userIds = await resolveAudience(
      app.prisma,
      orgId,
      body.audienceType as AudienceType,
      body.audienceConfig,
    );

    const campaign = await app.prisma.notificationCampaign.create({
      data: {
        organizationId: orgId,
        title: body.title,
        body: body.body,
        type: body.type as NotificationType,
        imageUrl: body.imageUrl,
        data: Object.keys(notifData).length > 0 ? (notifData as any) : undefined,
        audienceType: body.audienceType as AudienceType,
        audienceConfig: body.audienceConfig as any,
        status: "SENDING",
        recipientCount: userIds.length,
        sentBy: admin.sub,
      },
    });

    // Fire-and-forget: send in background, mark SENT when done
    sendCampaignNotifications(app.fcm, app.prisma, campaign.id, userIds, {
      type: body.type as NotificationType,
      title: body.title,
      body: body.body,
      imageUrl: body.imageUrl,
      data: Object.keys(notifData).length > 0 ? (notifData as any) : undefined,
    })
      .then(() =>
        app.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: { status: "SENT", sentAt: new Date() },
        }),
      )
      .catch(async (err) => {
        app.log.error(err, `Campaign ${campaign.id} failed`);
        await app.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: { status: "FAILED" },
        });
      });

    const response: ApiResponse<{ campaignId: string; recipientCount: number; status: string }> = {
      success: true,
      data: { campaignId: campaign.id, recipientCount: userIds.length, status: "SENDING" },
    };
    return response;
  });

  // ── Audience Preview ─────────────────────────────────
  app.post("/admin/audience-preview", { preHandler: adminPreHandler }, async (request, reply) => {
    const admin = getOrgUser(request);
    const body = audiencePreviewSchema.parse(request.body);

    let orgId = admin.organizationId;
    if (!orgId && admin.role !== "SUPER_ADMIN") {
      return reply.forbidden("Organization context required");
    }
    if (!orgId) {
      const firstOrg = await app.prisma.organization.findFirst({ select: { id: true } });
      orgId = firstOrg?.id;
      if (!orgId) return reply.badRequest("No organization found");
    }

    const userIds = await resolveAudience(
      app.prisma,
      orgId,
      body.audienceType as AudienceType,
      body.audienceConfig,
    );

    const response: ApiResponse<{ count: number }> = {
      success: true,
      data: { count: userIds.length },
    };
    return response;
  });

  // ═══════════════════════════════════════════════════════
  // TEMPLATE ENDPOINTS
  // ═══════════════════════════════════════════════════════

  // GET /notifications/admin/templates
  app.get("/admin/templates", { preHandler: adminPreHandler }, async (request, reply) => {
    const { user, orgId } = getAdminOrgId(request);
    if (!orgId && user.role !== "SUPER_ADMIN") return reply.forbidden("Organization context required");

    const { page = "1", pageSize = "20", q } = request.query as {
      page?: string;
      pageSize?: string;
      q?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, any> = {};
    if (orgId) where.organizationId = orgId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ];
    }

    const [templates, total] = await Promise.all([
      app.prisma.notificationTemplate.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: { creator: { select: { name: true } } },
      }),
      app.prisma.notificationTemplate.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof templates)[0]> = {
      success: true,
      data: templates,
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
    return response;
  });

  // GET /notifications/admin/templates/:id
  app.get<{ Params: { id: string } }>("/admin/templates/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    const { orgId } = getAdminOrgId(request);

    const template = await app.prisma.notificationTemplate.findUnique({
      where: { id: request.params.id },
      include: { creator: { select: { name: true } } },
    });

    if (!template) return reply.notFound("Template not found");
    if (orgId && template.organizationId !== orgId) return reply.forbidden("Access denied");

    const response: ApiResponse<typeof template> = { success: true, data: template };
    return response;
  });

  // POST /notifications/admin/templates
  app.post("/admin/templates", { preHandler: adminPreHandler }, async (request, reply) => {
    const admin = getOrgUser(request);
    const body = createNotificationTemplateSchema.parse(request.body);

    let orgId = admin.organizationId;
    if (!orgId && admin.role !== "SUPER_ADMIN") {
      return reply.forbidden("Organization context required");
    }
    if (!orgId) {
      const firstOrg = await app.prisma.organization.findFirst({ select: { id: true } });
      orgId = firstOrg?.id;
      if (!orgId) return reply.badRequest("No organization found");
    }

    const template = await app.prisma.notificationTemplate.create({
      data: {
        organizationId: orgId,
        name: body.name,
        title: body.title,
        body: body.body,
        type: body.type as NotificationType,
        imageUrl: body.imageUrl,
        createdBy: admin.sub,
      },
    });

    const response: ApiResponse<typeof template> = { success: true, data: template };
    return response;
  });

  // PUT /notifications/admin/templates/:id
  app.put<{ Params: { id: string } }>("/admin/templates/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    const { orgId } = getAdminOrgId(request);
    const body = updateNotificationTemplateSchema.parse(request.body);

    const existing = await app.prisma.notificationTemplate.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) return reply.notFound("Template not found");
    if (orgId && existing.organizationId !== orgId) return reply.forbidden("Access denied");

    const template = await app.prisma.notificationTemplate.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.type !== undefined && { type: body.type as NotificationType }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      },
    });

    const response: ApiResponse<typeof template> = { success: true, data: template };
    return response;
  });

  // DELETE /notifications/admin/templates/:id
  app.delete<{ Params: { id: string } }>("/admin/templates/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    const { orgId } = getAdminOrgId(request);

    const existing = await app.prisma.notificationTemplate.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) return reply.notFound("Template not found");
    if (orgId && existing.organizationId !== orgId) return reply.forbidden("Access denied");

    await app.prisma.notificationTemplate.delete({
      where: { id: request.params.id },
    });

    const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
    return response;
  });
}
