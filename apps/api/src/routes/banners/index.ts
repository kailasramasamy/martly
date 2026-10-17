import type { FastifyInstance } from "fastify";
import { createBannerSchema, updateBannerSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";

// A promotion launches, ends and reverts its own banner; edits made here would drift from it
const PROMO_OWNED = "This banner belongs to a promotion. Change it from the promotion instead.";

export async function bannerRoutes(app: FastifyInstance) {
  // Public: fetch active banners by placement for a store
  app.get<{ Params: { storeId: string } }>(
    "/by-placement/:storeId",
    async (request, reply) => {
      const { storeId } = request.params;
      const { placement, categoryId, departmentId, subcategoryId } = request.query as { placement?: string; categoryId?: string; departmentId?: string; subcategoryId?: string };

      if (!placement) return reply.badRequest("placement query param is required");

      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const now = new Date();
      const baseWhere = {
        isActive: true,
        placement: placement as any,
        OR: [
          { storeId },
          { storeId: null, organizationId: store.organizationId },
          { storeId: null, organizationId: null },
        ],
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      };
      const selectFields = {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        imageUrls: true,
        textInImage: true,
        placement: true,
        actionType: true,
        actionTarget: true,
      };

      let banners;
      const taxFilter = subcategoryId ? { subcategoryId } : categoryId ? { categoryId } : departmentId ? { departmentId } : null;
      if (taxFilter) {
        banners = await app.prisma.banner.findMany({
          where: { ...baseWhere, ...taxFilter },
          orderBy: { sortOrder: "asc" },
          select: selectFields,
        });
        if (banners.length === 0) {
          banners = await app.prisma.banner.findMany({
            where: { ...baseWhere, departmentId: null, categoryId: null, subcategoryId: null },
            orderBy: { sortOrder: "asc" },
            select: selectFields,
          });
        }
      } else {
        banners = await app.prisma.banner.findMany({
          where: baseWhere,
          orderBy: { sortOrder: "asc" },
          select: selectFields,
        });
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

      const banner = await app.prisma.banner.create({
        data: body,
        include: {
          organization: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
        },
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

      const banner = await app.prisma.banner.update({
        where: { id: request.params.id },
        data: body,
        include: {
          organization: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
        },
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
