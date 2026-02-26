import type { FastifyInstance } from "fastify";
import { createDeliveryTierSchema, updateDeliveryTierSchema, deliveryLookupSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { haversine } from "../../lib/geo.js";

export async function deliveryTierRoutes(app: FastifyInstance) {
  // GET / — List tiers for a store
  app.get("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request, reply) => {
    const { storeId, page = 1, pageSize = 50 } = request.query as {
      storeId?: string; page?: number; pageSize?: number;
    };

    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const where = { storeId };

    const [tiers, total] = await Promise.all([
      app.prisma.deliveryTier.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { minDistance: "asc" },
        include: { store: { select: { id: true, name: true } } },
      }),
      app.prisma.deliveryTier.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof tiers)[0]> = {
      success: true,
      data: tiers,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // GET /:id — Single tier
  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request, reply) => {
    const tier = await app.prisma.deliveryTier.findUnique({
      where: { id: request.params.id },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!tier) return reply.notFound("Delivery tier not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, tier.storeId))) {
      return reply.forbidden("Access denied");
    }

    const response: ApiResponse<typeof tier> = { success: true, data: tier };
    return response;
  });

  // POST / — Create tier
  app.post("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = createDeliveryTierSchema.parse(request.body);

    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
      return reply.forbidden("Access denied");
    }

    if (body.minDistance >= body.maxDistance) {
      return reply.badRequest("minDistance must be less than maxDistance");
    }

    // Check for overlapping tiers
    const existing = await app.prisma.deliveryTier.findMany({
      where: { storeId: body.storeId },
    });
    const overlaps = existing.some(
      (t) => body.minDistance < t.maxDistance && body.maxDistance > t.minDistance,
    );
    if (overlaps) {
      return reply.badRequest("Distance range overlaps with an existing tier");
    }

    const tier = await app.prisma.deliveryTier.create({
      data: body,
      include: { store: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof tier> = { success: true, data: tier };
    return response;
  });

  // PUT /:id — Update tier
  app.put<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = updateDeliveryTierSchema.parse(request.body);

    const existing = await app.prisma.deliveryTier.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery tier not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
    }

    const newMin = body.minDistance ?? existing.minDistance;
    const newMax = body.maxDistance ?? existing.maxDistance;
    if (newMin >= newMax) {
      return reply.badRequest("minDistance must be less than maxDistance");
    }

    // Check overlaps (excluding self)
    const otherTiers = await app.prisma.deliveryTier.findMany({
      where: { storeId: existing.storeId, id: { not: existing.id } },
    });
    const overlaps = otherTiers.some(
      (t) => newMin < t.maxDistance && newMax > t.minDistance,
    );
    if (overlaps) {
      return reply.badRequest("Distance range overlaps with an existing tier");
    }

    const tier = await app.prisma.deliveryTier.update({
      where: { id: request.params.id },
      data: body,
      include: { store: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof tier> = { success: true, data: tier };
    return response;
  });

  // DELETE /:id — Delete tier
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const existing = await app.prisma.deliveryTier.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery tier not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
    }

    await app.prisma.deliveryTier.delete({ where: { id: request.params.id } });

    const response: ApiResponse<null> = { success: true, data: null };
    return response;
  });

  // POST /lookup — Public: check serviceability for a location
  app.post("/lookup", { preHandler: [authenticateOptional] }, async (request) => {
    const body = deliveryLookupSchema.parse(request.body);

    const store = await app.prisma.store.findUnique({
      where: { id: body.storeId },
      select: { id: true, name: true, address: true, latitude: true, longitude: true, deliveryRadius: true },
    });

    if (!store || store.latitude == null || store.longitude == null) {
      return {
        success: true,
        data: {
          serviceable: false,
          reason: "Store location not configured",
          pickupAvailable: true,
          storeName: store?.name,
          storeAddress: store?.address,
        },
      };
    }

    const distance = haversine(body.latitude, body.longitude, store.latitude, store.longitude);

    if (distance > store.deliveryRadius) {
      return {
        success: true,
        data: {
          serviceable: false,
          distance,
          reason: "Too far from store",
          pickupAvailable: true,
          storeName: store.name,
          storeAddress: store.address,
        },
      };
    }

    const tier = await app.prisma.deliveryTier.findFirst({
      where: {
        storeId: body.storeId,
        isActive: true,
        minDistance: { lte: distance },
        maxDistance: { gt: distance },
      },
      orderBy: { minDistance: "asc" },
    });

    if (!tier) {
      return {
        success: true,
        data: {
          serviceable: false,
          distance,
          reason: "No delivery tier for this distance",
          pickupAvailable: true,
          storeName: store.name,
          storeAddress: store.address,
        },
      };
    }

    return {
      success: true,
      data: {
        serviceable: true,
        distance,
        deliveryFee: Number(tier.deliveryFee),
        estimatedMinutes: tier.estimatedMinutes,
        pickupAvailable: true,
        storeName: store.name,
        storeAddress: store.address,
      },
    };
  });
}
