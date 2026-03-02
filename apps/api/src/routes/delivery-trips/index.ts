import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { createDeliveryTripSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { broadcastOrderUpdate } from "../../services/order-broadcast.js";

const staffAuth = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF")];

export async function deliveryTripRoutes(app: FastifyInstance) {
  // List riders (staff assigned to a store)
  app.get("/riders", { preHandler: staffAuth }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const userStores = await app.prisma.userStore.findMany({
      where: { storeId },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    });

    const riders = userStores.map((us) => us.user);
    return { success: true, data: riders } satisfies ApiResponse<typeof riders>;
  });

  // Create a delivery trip
  app.post("/", { preHandler: staffAuth }, async (request, reply) => {
    const body = createDeliveryTripSchema.parse(request.body);

    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
      return reply.forbidden("Access denied");
    }

    // Validate rider is assigned to this store
    const riderAssignment = await app.prisma.userStore.findUnique({
      where: { userId_storeId: { userId: body.riderId, storeId: body.storeId } },
    });
    if (!riderAssignment) {
      return reply.badRequest("Rider is not assigned to this store");
    }

    // Validate all orders: READY, express (no deliverySlotId), unassigned (no deliveryTripId), belong to store
    const orders = await app.prisma.order.findMany({
      where: { id: { in: body.orderIds } },
      select: { id: true, status: true, storeId: true, deliverySlotId: true, deliveryTripId: true },
    });

    if (orders.length !== body.orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = body.orderIds.filter((id) => !foundIds.has(id));
      return reply.badRequest(`Orders not found: ${missing.map((id) => id.slice(0, 8)).join(", ")}`);
    }

    for (const order of orders) {
      if (order.status !== "READY") {
        return reply.badRequest(`Order ${order.id.slice(0, 8)} is ${order.status}, expected READY`);
      }
      // No deliverySlotId restriction — both express and scheduled orders can be grouped into trips
      if (order.deliveryTripId) {
        return reply.badRequest(`Order ${order.id.slice(0, 8)} is already assigned to a trip`);
      }
      if (order.storeId !== body.storeId) {
        return reply.badRequest(`Order ${order.id.slice(0, 8)} does not belong to this store`);
      }
    }

    // Look up organizationId from store
    const store = await app.prisma.store.findUnique({
      where: { id: body.storeId },
      select: { organizationId: true },
    });
    if (!store) return reply.notFound("Store not found");

    const trip = await app.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryTrip.create({
        data: {
          storeId: body.storeId,
          riderId: body.riderId,
          organizationId: store.organizationId,
          status: "CREATED",
        },
        include: {
          rider: { select: { id: true, name: true, phone: true } },
          orders: {
            select: {
              id: true, status: true, totalAmount: true, deliveryAddress: true, deliveryPincode: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Link orders to trip with delivery sequence
      for (let i = 0; i < body.orderIds.length; i++) {
        await tx.order.update({
          where: { id: body.orderIds[i] },
          data: { deliveryTripId: created.id, deliverySequence: i + 1 },
        });
      }

      // Re-fetch with linked orders
      return tx.deliveryTrip.findUnique({
        where: { id: created.id },
        include: {
          rider: { select: { id: true, name: true, phone: true } },
          orders: {
            select: {
              id: true, status: true, totalAmount: true, deliveryAddress: true, deliveryPincode: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return { success: true, data: trip } satisfies ApiResponse<typeof trip>;
  });

  // List trips for a store on a date
  app.get("/", { preHandler: staffAuth }, async (request, reply) => {
    const { storeId, date } = request.query as { storeId?: string; date?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const targetDate = date ? new Date(date + "T00:00:00") : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const trips = await app.prisma.deliveryTrip.findMany({
      where: {
        storeId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        rider: { select: { id: true, name: true, phone: true } },
        orders: {
          orderBy: { deliverySequence: "asc" },
          select: {
            id: true, status: true, totalAmount: true, deliveryAddress: true, deliveryPincode: true,
            deliverySequence: true, createdAt: true,
            user: { select: { id: true, name: true } },
            items: { include: { product: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: trips } satisfies ApiResponse<typeof trips>;
  });

  // Start a trip
  app.patch<{ Params: { id: string } }>("/:id/start", { preHandler: staffAuth }, async (request, reply) => {
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: request.params.id },
      include: { orders: { select: { id: true, status: true } } },
    });
    if (!trip) return reply.notFound("Trip not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) {
      return reply.forbidden("Access denied");
    }

    if (trip.status !== "CREATED") {
      return reply.badRequest(`Cannot start trip in ${trip.status} status`);
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.deliveryTrip.update({
        where: { id: trip.id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      // Move all trip orders to OUT_FOR_DELIVERY
      const readyOrders = trip.orders.filter((o) => o.status === "READY");
      for (const order of readyOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "OUT_FOR_DELIVERY" },
        });
        await tx.orderStatusLog.create({
          data: { orderId: order.id, status: "OUT_FOR_DELIVERY", note: "Trip started" },
        });
      }

      return updatedTrip;
    });

    // Broadcast order updates outside transaction
    for (const order of trip.orders.filter((o) => o.status === "READY")) {
      broadcastOrderUpdate(app.prisma, order.id, "OUT_FOR_DELIVERY");
    }

    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });

  // Cancel a trip
  app.patch<{ Params: { id: string } }>("/:id/cancel", { preHandler: staffAuth }, async (request, reply) => {
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: request.params.id },
      include: { orders: { select: { id: true } } },
    });
    if (!trip) return reply.notFound("Trip not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) {
      return reply.forbidden("Access denied");
    }

    if (trip.status !== "CREATED") {
      return reply.badRequest(`Cannot cancel trip in ${trip.status} status`);
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.deliveryTrip.update({
        where: { id: trip.id },
        data: { status: "CANCELLED" },
      });

      // Unlink orders from trip
      await tx.order.updateMany({
        where: { deliveryTripId: trip.id },
        data: { deliveryTripId: null },
      });

      return updatedTrip;
    });

    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });
}
