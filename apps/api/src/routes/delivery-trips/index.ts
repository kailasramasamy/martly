import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { assignTripsSchema, createDeliveryTripSchema, failDeliverySchema, moveTripOrderSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";
import { storeRiders } from "../../services/permissions.js";
import { istDay } from "../../services/ist-day.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { broadcastOutForDelivery, startTripInTx, tripOrderProblem } from "../../services/delivery-trips.js";
import { broadcastOrderUpdate } from "../../services/order-broadcast.js";
import { TripOpError, assignTrips, failDelivery, moveOrder, orderWave, sendToRider, startProblem } from "../../services/delivery/trip-ops.js";
import { riderDay, storeRiderSummary } from "../../services/delivery/rider.js";

const dispatchAuth = [authenticate, requirePermission(Permission.ORDERS_DISPATCH)];
const riderAuth = [authenticate, requirePermission(Permission.DELIVERY_DELIVER)];
const isDispatcher = (user: { role: string; permissions?: string[] }) =>
  user.role === "SUPER_ADMIN" || hasPermission(user.permissions, Permission.ORDERS_DISPATCH);

const tripInclude = {
  rider: { select: { id: true, name: true, phone: true } },
  orders: {
    select: {
      id: true, status: true, totalAmount: true, deliveryAddress: true, deliveryPincode: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

export async function deliveryTripRoutes(app: FastifyInstance) {
  // List riders (members assigned to the store who can deliver)
  app.get("/riders", { preHandler: dispatchAuth }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const riders = await storeRiders(app.prisma, storeId);
    return { success: true, data: riders } satisfies ApiResponse<typeof riders>;
  });

  // Create a delivery trip; with `start`, it goes on the road straight away
  app.post("/", { preHandler: dispatchAuth }, async (request, reply) => {
    const body = createDeliveryTripSchema.parse(request.body);
    const start = body.start ?? false;

    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
      return reply.forbidden("Access denied");
    }

    const rider = (await storeRiders(app.prisma, body.storeId)).find((r) => r.id === body.riderId);
    if (!rider) return reply.badRequest("Rider is not assigned to this store");

    const orders = await app.prisma.order.findMany({
      where: { id: { in: body.orderIds } },
      select: {
        id: true, status: true, storeId: true, fulfillmentType: true, deliveryTripId: true, deliverySlotId: true, scheduledDate: true,
        deliveryTrip: { select: { status: true } },
      },
    });
    const problem = tripOrderProblem(orders, body.orderIds, body.storeId, start);
    if (problem) return reply.badRequest(problem);

    const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    if (!store) return reply.notFound("Store not found");

    // Orders join the rider's unstarted trip for their wave, so assigning one at a time still builds one trip
    let sent: Awaited<ReturnType<typeof sendToRider>>;
    try {
      sent = await sendToRider(app.prisma, {
        storeId: body.storeId, organizationId: store.organizationId, rider, orderIds: body.orderIds, wave: orderWave(orders[0]), start,
      });
    } catch (err) {
      if (err instanceof TripOpError) return reply.badRequest(err.message);
      throw err;
    }
    const sentOut = sent.sentOut;
    const trip = await app.prisma.deliveryTrip.findUnique({ where: { id: sent.tripId }, include: tripInclude });

    broadcastOutForDelivery(app.fcm, app.prisma, sentOut).catch((err: unknown) => app.log.error(err, "Out-for-delivery notifications failed"));
    return { success: true, data: trip } satisfies ApiResponse<typeof trip>;
  });

  // List trips for a store on a date
  app.get("/", { preHandler: [authenticate, requirePermission(Permission.ORDERS_VIEW)] }, async (request, reply) => {
    const { storeId, date, includePlanned } = request.query as { storeId?: string; date?: string; includePlanned?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const day = istDay(date);
    const trips = await app.prisma.deliveryTrip.findMany({
      where: {
        storeId,
        // Planned trips have no rider yet; they live on the planning board (/delivery-plan)
        ...(includePlanned === "true" ? {} : { status: { not: "PLANNED" } }),
        // Today also shows unfinished trips started on earlier days
        OR: [
          { createdAt: { gte: day.start, lte: day.end } },
          ...(day.isToday ? [{ createdAt: { lt: day.start }, status: { in: ["CREATED", "IN_PROGRESS"] as ("CREATED" | "IN_PROGRESS")[] } }] : []),
        ],
      },
      include: {
        rider: { select: { id: true, name: true, phone: true } },
        orders: {
          orderBy: { deliverySequence: "asc" },
          select: {
            id: true, storeId: true, status: true, totalAmount: true, deliveryAddress: true, deliveryPincode: true,
            deliverySequence: true, createdAt: true, paymentMethod: true, paymentStatus: true,
            fulfillmentType: true, deliveryTripId: true,
            user: { select: { id: true, name: true, phone: true } },
            items: {
              include: {
                product: { select: { name: true, imageUrl: true, images: true } },
                variant: { select: { name: true, imageUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: trips } satisfies ApiResponse<typeof trips>;
  });

  // Start a trip
  app.patch<{ Params: { id: string } }>("/:id/start", { preHandler: [authenticate, requirePermission(Permission.ORDERS_DISPATCH, Permission.DELIVERY_DELIVER)] }, async (request, reply) => {
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: request.params.id },
      include: { rider: { select: { name: true } } },
    });
    if (!trip) return reply.notFound("Trip not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) {
      return reply.forbidden("Access denied");
    }
    if (!hasPermission(request.user.permissions, Permission.ORDERS_DISPATCH) && request.user.role !== "SUPER_ADMIN" && trip.riderId !== request.user.sub) {
      return reply.forbidden("Not your trip");
    }

    const blocked = await startProblem(app.prisma, trip);
    if (blocked || !trip.rider) return reply.badRequest(blocked ?? "Assign a rider before starting this trip");

    const riderName = trip.rider.name;
    const sentOut = await app.prisma.$transaction((tx) => startTripInTx(tx, trip.id, riderName));
    broadcastOutForDelivery(app.fcm, app.prisma, sentOut).catch((err: unknown) => app.log.error(err, "Out-for-delivery notifications failed"));
    const updated = await app.prisma.deliveryTrip.findUnique({ where: { id: trip.id } });

    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });

  // A rider's own day: trips with every stop's details, and how the day is going
  app.get("/mine", { preHandler: riderAuth }, async (request) => {
    const { date } = request.query as { date?: string };
    const data = await riderDay(app.prisma, request.user.sub, date);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // Per-rider trips, deliveries, failed attempts and cash for a store's day
  app.get("/summary", { preHandler: [authenticate, requirePermission(Permission.ORDERS_VIEW, Permission.ORDERS_DISPATCH, Permission.RIDERS_MANAGE)] }, async (request, reply) => {
    const { storeId, date } = request.query as { storeId?: string; date?: string };
    if (!storeId) return reply.badRequest("storeId is required");
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied");
    const data = await storeRiderSummary(app.prisma, storeId, date);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // The rider couldn't hand an order over: it goes back to the store as Ready, with the reason on record
  app.post<{ Params: { id: string; orderId: string } }>("/:id/orders/:orderId/fail", { preHandler: [authenticate, requirePermission(Permission.ORDERS_DISPATCH, Permission.DELIVERY_DELIVER)] }, async (request, reply) => {
    const body = failDeliverySchema.parse(request.body);
    const trip = await app.prisma.deliveryTrip.findUnique({ where: { id: request.params.id }, select: { storeId: true, riderId: true, status: true } });
    if (!trip) return reply.notFound("Trip not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) return reply.forbidden("Access denied");
    if (!isDispatcher(request.user) && trip.riderId !== request.user.sub) return reply.forbidden("Not your trip");
    if (trip.status !== "IN_PROGRESS" || !trip.riderId) return reply.badRequest("Trip is not on the road");
    try {
      await failDelivery(app.prisma, { tripId: request.params.id, orderId: request.params.orderId, riderId: trip.riderId, ...body });
    } catch (err) {
      if (err instanceof TripOpError) return reply.badRequest(err.message);
      throw err;
    }
    broadcastOrderUpdate(app.prisma, request.params.orderId, "READY");
    return { success: true, data: { orderId: request.params.orderId, status: "READY" } } satisfies ApiResponse<{ orderId: string; status: string }>;
  });

  // Give planned trips to riders (or hand an unstarted trip to someone else)
  app.post("/assign", { preHandler: dispatchAuth }, async (request, reply) => {
    const { assignments } = assignTripsSchema.parse(request.body);
    const first = await app.prisma.deliveryTrip.findUnique({ where: { id: assignments[0].tripId }, select: { storeId: true } });
    if (!first) return reply.notFound("Trip not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, first.storeId))) return reply.forbidden("Access denied");
    const riders = new Set((await storeRiders(app.prisma, first.storeId)).map((r) => r.id));
    try {
      await assignTrips(app.prisma, first.storeId, riders, assignments);
    } catch (err) {
      if (err instanceof TripOpError) return reply.badRequest(err.message);
      throw err;
    }
    return { success: true, data: { assigned: assignments.length } } satisfies ApiResponse<{ assigned: number }>;
  });

  // Move a stop to another unstarted trip, or back to the unplanned pool
  app.post<{ Params: { id: string } }>("/:id/move-order", { preHandler: dispatchAuth }, async (request, reply) => {
    const { orderId, toTripId } = moveTripOrderSchema.parse(request.body);
    const trip = await app.prisma.deliveryTrip.findUnique({ where: { id: request.params.id }, select: { storeId: true } });
    if (!trip) return reply.notFound("Trip not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) return reply.forbidden("Access denied");
    try {
      await moveOrder(app.prisma, request.params.id, orderId, toTripId);
    } catch (err) {
      if (err instanceof TripOpError) return reply.badRequest(err.message);
      throw err;
    }
    return { success: true, data: { moved: orderId } } satisfies ApiResponse<{ moved: string }>;
  });

  // Cancel a trip
  app.patch<{ Params: { id: string } }>("/:id/cancel", { preHandler: dispatchAuth }, async (request, reply) => {
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: request.params.id },
      include: { orders: { select: { id: true } } },
    });
    if (!trip) return reply.notFound("Trip not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) {
      return reply.forbidden("Access denied");
    }

    if (trip.status !== "CREATED" && trip.status !== "PLANNED") {
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
