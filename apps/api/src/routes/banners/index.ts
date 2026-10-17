import type { FastifyInstance } from "fastify";
import { bannerEventsSchema, generateBannerImageSchema, createBannerSchema, updateBannerSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { BannerPlacement, Permission } from "@martly/shared/constants";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { assertBannerSlot, takesSlot } from "../../services/marketing/entitlements.js";
import { recordBannerEvents } from "../../services/marketing/stats.js";
import { generateBannerImage } from "../../services/marketing/banner-image.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { storeBanners } from "../../services/marketing/banner-feed.js";

// A promotion launches, ends and reverts its own banner; edits made here would drift from it
const PROMO_OWNED = "This banner belongs to a promotion. Change it from the promotion instead.";

export async function bannerRoutes(app: FastifyInstance) {
  // Public: fetch active banners by placement for a store
  app.get<{ Params: { storeId: string } }>(
    "/by-placement/:storeId",
    async (request, reply) => {
      const { storeId } = request.params;
      const { placement, categoryId, departmentId, subcategoryId } = request.query as { placement?: string; categoryId?: string; departmentId?: string; subcategoryId?: string };

      if (!placement || !(placement in BannerPlacement)) return reply.badRequest("placement query param is required");

      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const kind = placement as BannerPlacement;
      const taxFilter = subcategoryId ? { subcategoryId } : categoryId ? { categoryId } : departmentId ? { departmentId } : null;
      // A category page shows banners made for it, else the general ones for that placement
      let banners = taxFilter ? await storeBanners(app.prisma, store, [kind], taxFilter) : [];
      if (!taxFilter || banners.length === 0) {
        banners = await storeBanners(app.prisma, store, [kind], taxFilter ? { departmentId: null, categoryId: null, subcategoryId: null } : {});
      }

      const response: ApiResponse<typeof banners> = { success: true, data: banners };
      return response;
    },
  );

  // List banners
  app.get("/", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request) => {
    const { page = 1, pageSize = 50, q, placement } = request.query as {
      page?: number; pageSize?: number; q?: string; placement?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};

    if (user.role !== "SUPER_ADMIN") {
      where.OR = [
        { organizationId: user.organizationId },
        { organizationId: null },
      ];
    }

    if (q) {
      where.title = { contains: q, mode: "insensitive" };
    }

    if (placement) {
      where.placement = placement;
    }

    const [banners, total] = await Promise.all([
      app.prisma.banner.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          organization: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
          promo: { select: { id: true, status: true } },
        },
      }),
      app.prisma.banner.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof banners)[0]> = {
      success: true,
      data: banners,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get banner by ID
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request, reply) => {
    const banner = await app.prisma.banner.findUnique({
      where: { id: request.params.id },
      include: {
        organization: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        promo: { select: { id: true, status: true } },
      },
    });
    if (!banner) return reply.notFound("Banner not found");
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && banner.organizationId && banner.organizationId !== user.organizationId) {
      return reply.forbidden("Access denied");
    }

    const response: ApiResponse<typeof banner> = { success: true, data: banner };
    return response;
  });

  // AI-painted banner image with the copy set in; counts against the plan's monthly AI images
  app.post("/generate-image", { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI images need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const body = generateBannerImageSchema.parse(request.body);
    const user = getOrgUser(request);
    const organizationId = user.role === "SUPER_ADMIN" ? null : (user.organizationId ?? null);
    const art = await generateBannerImage(app.prisma, organizationId, body, (m) => request.log.warn(`banner image: ${m}`));
    return { success: true, data: art };
  });

  // Views and taps from the shopper app, batched; no login needed since guests see banners too
  app.post("/events", async (request) => {
    const { storeId, events } = bannerEventsSchema.parse(request.body);
    const recorded = await recordBannerEvents(app.prisma, storeId, events);
    return { success: true, data: { recorded } };
  });

  // Create banner
  app.post(
    "/",
    { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] },
    async (request, reply) => {
      const body = createBannerSchema.parse(request.body);
      const user = getOrgUser(request);

      if (body.storeId && !(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied");
      }

      // ORG_ADMIN: force their org
      if (user.role !== "SUPER_ADMIN") {
        body.organizationId = user.organizationId;
      }
      // Banners without an organisation are Martly's own; an organisation's banners use its plan's slots
      const sponsorType = body.organizationId ? "STORE" : "PLATFORM";

      const banner = await app.prisma.$transaction(async (tx) => {
        if (body.organizationId && user.role !== "SUPER_ADMIN" && takesSlot({ sponsorType, isActive: body.isActive ?? true, endsAt: body.endsAt ?? null })) {
          await assertBannerSlot(tx, body.organizationId);
        }
        return tx.banner.create({
          data: { ...body, sponsorType },
          include: {
            organization: { select: { id: true, name: true } },
            store: { select: { id: true, name: true } },
          },
        });
      });

      const response: ApiResponse<typeof banner> = { success: true, data: banner };
      return response;
    },
  );

  // Update banner
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] },
    async (request, reply) => {
      const body = updateBannerSchema.parse(request.body);
      const existing = await app.prisma.banner.findUnique({ where: { id: request.params.id }, include: { promo: { select: { id: true } } } });
      if (!existing) return reply.notFound("Banner not found");
      if (existing.promo) return reply.conflict(PROMO_OWNED);

      const user = getOrgUser(request);
      if (user.role !== "SUPER_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }
      if (body.storeId && !(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied");
      }

      const after = { ...existing, ...body };
      const banner = await app.prisma.$transaction(async (tx) => {
        // Switching a banner back on (or extending an ended one) needs a free slot again
        if (existing.organizationId && user.role !== "SUPER_ADMIN" && !takesSlot(existing) && takesSlot(after)) {
          await assertBannerSlot(tx, existing.organizationId);
        }
        return tx.banner.update({
          where: { id: request.params.id },
          data: body,
          include: {
            organization: { select: { id: true, name: true } },
            store: { select: { id: true, name: true } },
          },
        });
      });

      const response: ApiResponse<typeof banner> = { success: true, data: banner };
      return response;
    },
  );

  // Delete banner
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] },
    async (request, reply) => {
      const existing = await app.prisma.banner.findUnique({ where: { id: request.params.id }, include: { promo: { select: { id: true } } } });
      if (!existing) return reply.notFound("Banner not found");
      if (existing.promo) return reply.conflict(PROMO_OWNED);

      const user = getOrgUser(request);
      if (user.role !== "SUPER_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }

      await app.prisma.banner.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
