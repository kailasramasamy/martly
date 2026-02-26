import type { FastifyInstance } from "fastify";
import { createDeliveryZoneSchema, updateDeliveryZoneSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export async function deliveryZoneRoutes(app: FastifyInstance) {
  // GET / - List zones (org-scoped)
  app.get("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request) => {
    const { page = 1, pageSize = 50 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};
    if (user.role !== "SUPER_ADMIN" && user.organizationId) {
      where.organizationId = user.organizationId;
    }

    const [zones, total] = await Promise.all([
      app.prisma.deliveryZone.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: { stores: { include: { store: { select: { id: true, name: true } } } } },
      }),
      app.prisma.deliveryZone.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof zones)[0]> = {
      success: true,
      data: zones,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // GET /:id - Zone detail
  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request, reply) => {
    const zone = await app.prisma.deliveryZone.findUnique({
      where: { id: request.params.id },
      include: { stores: { include: { store: { select: { id: true, name: true } } } } },
    });
    if (!zone) return reply.notFound("Delivery zone not found");

    const response: ApiResponse<typeof zone> = { success: true, data: zone };
    return response;
  });

  // POST / - Create zone with storeIds
  app.post("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request) => {
    const body = createDeliveryZoneSchema.parse(request.body);
    const { storeIds, ...zoneData } = body;

    const zone = await app.prisma.deliveryZone.create({
      data: {
        ...zoneData,
        stores: storeIds?.length ? {
          create: storeIds.map((storeId) => ({ storeId })),
        } : undefined,
      },
      include: { stores: { include: { store: { select: { id: true, name: true } } } } },
    });

    const response: ApiResponse<typeof zone> = { success: true, data: zone };
    return response;
  });

  // PUT /:id - Update zone, sync stores
  app.put<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = updateDeliveryZoneSchema.parse(request.body);
    const { storeIds, ...zoneData } = body;

    const existing = await app.prisma.deliveryZone.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery zone not found");

    const zone = await app.prisma.$transaction(async (tx) => {
      if (storeIds !== undefined) {
        await tx.storeDeliveryZone.deleteMany({ where: { deliveryZoneId: request.params.id } });
        if (storeIds.length > 0) {
          await tx.storeDeliveryZone.createMany({
            data: storeIds.map((storeId) => ({ storeId, deliveryZoneId: request.params.id })),
          });
        }
      }

      return tx.deliveryZone.update({
        where: { id: request.params.id },
        data: zoneData,
        include: { stores: { include: { store: { select: { id: true, name: true } } } } },
      });
    });

    const response: ApiResponse<typeof zone> = { success: true, data: zone };
    return response;
  });

  // DELETE /:id - Delete zone
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const existing = await app.prisma.deliveryZone.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery zone not found");

    await app.prisma.$transaction(async (tx) => {
      await tx.storeDeliveryZone.deleteMany({ where: { deliveryZoneId: request.params.id } });
      await tx.deliveryZone.delete({ where: { id: request.params.id } });
    });

    const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
    return response;
  });

  // GET /lookup?storeId=X&pincode=Y - Public: find zone for store + pincode
  app.get("/lookup", { preHandler: [authenticateOptional] }, async (request) => {
    const { storeId, pincode } = request.query as { storeId?: string; pincode?: string };

    if (!storeId) {
      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    }

    const storeZones = await app.prisma.storeDeliveryZone.findMany({
      where: { storeId },
      include: { deliveryZone: true },
    });

    // Find matching zone by pincode, or return first active zone
    let matchedZone = null;
    if (pincode) {
      matchedZone = storeZones.find(
        (sz) => sz.deliveryZone.isActive && sz.deliveryZone.pincodes.includes(pincode),
      )?.deliveryZone;
    }
    if (!matchedZone) {
      matchedZone = storeZones.find((sz) => sz.deliveryZone.isActive)?.deliveryZone ?? null;
    }

    if (!matchedZone) {
      const response: ApiResponse<{ deliveryFee: number; estimatedMinutes: number } | null> = { success: true, data: null };
      return response;
    }

    const response: ApiResponse<{ deliveryFee: number; estimatedMinutes: number }> = {
      success: true,
      data: { deliveryFee: Number(matchedZone.deliveryFee), estimatedMinutes: matchedZone.estimatedMinutes },
    };
    return response;
  });
}
