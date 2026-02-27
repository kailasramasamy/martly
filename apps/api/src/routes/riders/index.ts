import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { createRiderSchema, updateRiderSchema } from "@martly/shared/schemas";
import bcrypt from "bcryptjs";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";

const auth = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")];

export async function riderRoutes(app: FastifyInstance) {
  // List riders for a store (with trip stats)
  app.get("/", { preHandler: auth }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const userStores = await app.prisma.userStore.findMany({
      where: { storeId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true, createdAt: true },
        },
      },
    });

    // Get trip stats for all riders in one query
    const riderIds = userStores.map((us) => us.user.id);

    const tripCounts = await app.prisma.deliveryTrip.groupBy({
      by: ["riderId", "status"],
      where: { riderId: { in: riderIds }, storeId },
      _count: { id: true },
    });

    // Build stats map
    const statsMap: Record<string, { total: number; active: number; completed: number }> = {};
    for (const row of tripCounts) {
      if (!statsMap[row.riderId]) {
        statsMap[row.riderId] = { total: 0, active: 0, completed: 0 };
      }
      statsMap[row.riderId].total += row._count.id;
      if (row.status === "CREATED" || row.status === "IN_PROGRESS") {
        statsMap[row.riderId].active += row._count.id;
      }
      if (row.status === "COMPLETED") {
        statsMap[row.riderId].completed += row._count.id;
      }
    }

    const riders = userStores.map((us) => ({
      id: us.user.id,
      name: us.user.name,
      phone: us.user.phone,
      email: us.user.email,
      createdAt: us.user.createdAt,
      tripStats: statsMap[us.user.id] ?? { total: 0, active: 0, completed: 0 },
    }));

    return { success: true, data: riders } satisfies ApiResponse<typeof riders>;
  });

  // Add a new rider
  app.post("/", { preHandler: auth }, async (request, reply) => {
    const body = createRiderSchema.parse(request.body);

    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
      return reply.forbidden("Access denied");
    }

    // Check email uniqueness
    const existing = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw Object.assign(new Error("A user with this email already exists"), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const rider = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          phone: body.phone,
          passwordHash,
          role: "STAFF",
        },
        select: { id: true, name: true, phone: true, email: true, createdAt: true },
      });

      await tx.userStore.create({
        data: {
          userId: user.id,
          storeId: body.storeId,
          role: "STAFF",
        },
      });

      return user;
    });

    return {
      success: true,
      data: { ...rider, tripStats: { total: 0, active: 0, completed: 0 } },
    } satisfies ApiResponse<typeof rider & { tripStats: { total: number; active: number; completed: number } }>;
  });

  // Update a rider
  app.put<{ Params: { id: string } }>("/:id", { preHandler: auth }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    // Verify rider is assigned to this store
    const assignment = await app.prisma.userStore.findUnique({
      where: { userId_storeId: { userId: request.params.id, storeId } },
    });
    if (!assignment) return reply.notFound("Rider not found at this store");

    const body = updateRiderSchema.parse(request.body);
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.email !== undefined) {
      // Check email uniqueness (exclude current user)
      const existing = await app.prisma.user.findFirst({
        where: { email: body.email, id: { not: request.params.id } },
      });
      if (existing) {
        throw Object.assign(new Error("A user with this email already exists"), { statusCode: 409 });
      }
      data.email = body.email;
    }
    if (body.password !== undefined) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const updated = await app.prisma.user.update({
      where: { id: request.params.id },
      data,
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    });

    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });

  // Remove a rider from a store
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: auth }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    // Verify assignment exists
    const assignment = await app.prisma.userStore.findUnique({
      where: { userId_storeId: { userId: request.params.id, storeId } },
    });
    if (!assignment) return reply.notFound("Rider not found at this store");

    // Check for active trips
    const activeTrips = await app.prisma.deliveryTrip.count({
      where: {
        riderId: request.params.id,
        storeId,
        status: { in: ["CREATED", "IN_PROGRESS"] },
      },
    });
    if (activeTrips > 0) {
      throw Object.assign(
        new Error(`Rider has ${activeTrips} active trip(s). Complete or cancel them first.`),
        { statusCode: 409 },
      );
    }

    // Remove store assignment only (not the user record)
    await app.prisma.userStore.delete({
      where: { userId_storeId: { userId: request.params.id, storeId } },
    });

    return { success: true, data: { removed: true } } satisfies ApiResponse<{ removed: boolean }>;
  });
}
