import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { broadcastRiderLocation, broadcastToTripSubscribers } from "../../services/ws-manager.js";
import { haversine, getDirectionsRoute, type DirectionsResult } from "../../lib/geo.js";

// In-memory store for rider locations (keyed by tripId)
const riderLocations = new Map<string, {
  riderId: string;
  tripId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
}>();

/** Store a rider location update (used by both REST and WebSocket paths) */
export function storeRiderLocation(tripId: string, data: { riderId?: string; lat: number; lng: number; heading?: number | null; speed?: number | null; updatedAt: string }) {
  riderLocations.set(tripId, {
    riderId: data.riderId ?? "",
    tripId,
    lat: data.lat,
    lng: data.lng,
    heading: data.heading ?? null,
    speed: data.speed ?? null,
    updatedAt: data.updatedAt,
  });
}

/** Clean up stale locations older than 10 minutes */
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [tripId, loc] of riderLocations) {
    if (new Date(loc.updatedAt).getTime() < cutoff) {
      riderLocations.delete(tripId);
    }
  }
}, 60_000);

// In-memory route cache (keyed by tripId)
interface RouteCacheEntry {
  result: DirectionsResult;
  originLat: number;
  originLng: number;
  stopCount: number;
  cachedAt: number;
}
const routeCache = new Map<string, RouteCacheEntry>();

// Clean stale route cache entries every 60s
setInterval(() => {
  const cutoff = Date.now() - 120_000; // 2 minutes
  for (const [tripId, entry] of routeCache) {
    if (entry.cachedAt < cutoff) {
      routeCache.delete(tripId);
    }
  }
}, 60_000);

const riderAuth = [authenticate, requireRole("STAFF", "STORE_MANAGER", "ORG_ADMIN", "SUPER_ADMIN")];

export async function riderLocationRoutes(app: FastifyInstance) {
  /**
   * POST /rider-location
   * Rider pushes GPS update for their active trip.
   * Also broadcasts via WebSocket to subscribed customers.
   */
  app.post("/", { preHandler: riderAuth }, async (request, reply) => {
    const user = getOrgUser(request);
    const { tripId, lat, lng, heading, speed } = request.body as {
      tripId: string;
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
    };

    if (!tripId || lat == null || lng == null) {
      return reply.badRequest("tripId, lat, and lng are required");
    }

    // Verify rider owns this trip
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      select: { riderId: true, status: true },
    });
    if (!trip) return reply.notFound("Trip not found");
    if (trip.riderId !== user.sub) return reply.forbidden("Not your trip");
    if (trip.status !== "IN_PROGRESS") {
      return reply.badRequest("Trip is not in progress");
    }

    const location = {
      riderId: user.sub,
      tripId,
      lat,
      lng,
      heading: heading ?? null,
      speed: speed ?? null,
      updatedAt: new Date().toISOString(),
    };

    // Store in memory
    riderLocations.set(tripId, location);

    // Broadcast to subscribed customers via WebSocket
    broadcastRiderLocation(tripId, {
      lat,
      lng,
      heading,
      speed,
      updatedAt: location.updatedAt,
    });

    return { success: true, data: { received: true } } satisfies ApiResponse<{ received: true }>;
  });

  /**
   * GET /rider-location/:tripId
   * Customer fetches the latest known rider location for a trip.
   */
  app.get<{ Params: { tripId: string } }>("/:tripId", { preHandler: [authenticate] }, async (request, reply) => {
    const { tripId } = request.params;
    const user = getOrgUser(request);

    // Verify the customer has an order in this trip
    if (user.role === "CUSTOMER") {
      const orderInTrip = await app.prisma.order.findFirst({
        where: { deliveryTripId: tripId, userId: user.sub },
        select: { id: true },
      });
      if (!orderInTrip) return reply.forbidden("Access denied");
    }

    const location = riderLocations.get(tripId);
    if (!location) {
      return { success: true, data: null } satisfies ApiResponse<null>;
    }

    return { success: true, data: location } satisfies ApiResponse<typeof location>;
  });

  /**
   * GET /rider-location/by-order/:orderId
   * Customer looks up rider location by their order ID.
   * Returns trip info + rider location + rider details.
   */
  app.get<{ Params: { orderId: string } }>(
    "/by-order/:orderId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { orderId } = request.params;
      const user = getOrgUser(request);

      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          status: true,
          deliveryTripId: true,
          deliveryAddress: true,
          deliveryLat: true,
          deliveryLng: true,
          deliverySequence: true,
          store: { select: { name: true, latitude: true, longitude: true } },
          deliveryTrip: {
            select: {
              id: true,
              status: true,
              rider: { select: { id: true, name: true, phone: true } },
              orders: {
                where: { status: "OUT_FOR_DELIVERY" },
                orderBy: { deliverySequence: "asc" },
                select: {
                  id: true,
                  deliveryLat: true,
                  deliveryLng: true,
                  deliverySequence: true,
                },
              },
            },
          },
        },
      });

      if (!order) return reply.notFound("Order not found");

      // Customer can only see their own order
      if (user.role === "CUSTOMER" && order.userId !== user.sub) {
        return reply.forbidden("Access denied");
      }

      if (!order.deliveryTripId || !order.deliveryTrip) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      const location = riderLocations.get(order.deliveryTripId);

      // Build anonymized remaining stops
      const tripOrders = order.deliveryTrip.orders;
      const remainingStops = tripOrders
        .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
        .map((o) => ({
          sequence: o.deliverySequence ?? 0,
          lat: o.deliveryLat!,
          lng: o.deliveryLng!,
          isYourStop: o.id === orderId,
        }));

      const customerStop = remainingStops.find((s) => s.isYourStop);
      const customerStopNumber = customerStop
        ? remainingStops.indexOf(customerStop) + 1
        : null;

      return {
        success: true,
        data: {
          tripId: order.deliveryTrip.id,
          tripStatus: order.deliveryTrip.status,
          rider: order.deliveryTrip.rider,
          location: location
            ? { lat: location.lat, lng: location.lng, heading: location.heading, speed: location.speed, updatedAt: location.updatedAt }
            : null,
          store: order.store,
          deliveryAddress: order.deliveryAddress,
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          remainingStops,
          customerStopNumber,
          totalStops: remainingStops.length,
        },
      };
    },
  );

  /**
   * GET /rider-location/route/by-order/:orderId
   * Customer fetches the driving route polyline for their delivery.
   * Returns polyline coordinates, legs with duration/distance, and totals.
   * Cached in-memory: reuses cache if <60s old, rider moved <500m, same stop count.
   */
  app.get<{ Params: { orderId: string } }>(
    "/route/by-order/:orderId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { orderId } = request.params;
      const user = getOrgUser(request);

      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          deliveryTripId: true,
          deliveryLat: true,
          deliveryLng: true,
          deliverySequence: true,
          deliveryTrip: {
            select: {
              id: true,
              status: true,
              orders: {
                where: { status: "OUT_FOR_DELIVERY" },
                orderBy: { deliverySequence: "asc" },
                select: {
                  id: true,
                  deliveryLat: true,
                  deliveryLng: true,
                  deliverySequence: true,
                },
              },
            },
          },
        },
      });

      if (!order) return reply.notFound("Order not found");
      if (user.role === "CUSTOMER" && order.userId !== user.sub) {
        return reply.forbidden("Access denied");
      }
      if (!order.deliveryTripId || !order.deliveryTrip) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      const tripId = order.deliveryTrip.id;
      const riderLoc = riderLocations.get(tripId);
      if (!riderLoc) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      // Build waypoints: remaining stops sorted by sequence
      const stops = order.deliveryTrip.orders
        .filter((o) => o.deliveryLat != null && o.deliveryLng != null);

      if (stops.length === 0) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      const origin = { lat: riderLoc.lat, lng: riderLoc.lng };
      const destination = { lat: stops[stops.length - 1].deliveryLat!, lng: stops[stops.length - 1].deliveryLng! };
      const waypoints = stops.length > 1
        ? stops.slice(0, -1).map((s) => ({ lat: s.deliveryLat!, lng: s.deliveryLng! }))
        : undefined;

      // Check route cache
      const cached = routeCache.get(tripId);
      if (cached) {
        const age = Date.now() - cached.cachedAt;
        const riderMoved = haversine(cached.originLat, cached.originLng, origin.lat, origin.lng);
        if (age < 60_000 && riderMoved < 0.5 && cached.stopCount === stops.length) {
          return { success: true, data: cached.result };
        }
      }

      // Fetch fresh route from Google Directions
      const result = await getDirectionsRoute(origin, destination, waypoints);
      if (!result) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      // Cache the result
      routeCache.set(tripId, {
        result,
        originLat: origin.lat,
        originLng: origin.lng,
        stopCount: stops.length,
        cachedAt: Date.now(),
      });

      return { success: true, data: result };
    },
  );

  /**
   * GET /rider-location/my-trips
   * Rider fetches their assigned trips for today.
   */
  app.get("/my-trips", { preHandler: riderAuth }, async (request) => {
    const user = getOrgUser(request);
    const { period } = request.query as { period?: string };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dateFilter = period === "history"
      ? { lt: startOfDay }   // Past trips (before today)
      : { gte: startOfDay }; // Today's trips (default)

    const trips = await app.prisma.deliveryTrip.findMany({
      where: {
        riderId: user.sub,
        createdAt: dateFilter,
      },
      include: {
        store: { select: { id: true, name: true, latitude: true, longitude: true, address: true } },
        orders: {
          orderBy: { deliverySequence: "asc" },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            deliveryAddress: true,
            deliveryLat: true,
            deliveryLng: true,
            deliveryPincode: true,
            deliverySequence: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            user: { select: { id: true, name: true, phone: true } },
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                product: { select: { name: true, imageUrl: true } },
                variant: { select: { name: true, unitType: true, unitValue: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: trips };
  });

  /**
   * PATCH /rider-location/trips/:tripId/deliver/:orderId
   * Rider marks a single order in their trip as DELIVERED.
   * If all orders in the trip are delivered, completes the trip.
   */
  app.patch<{ Params: { tripId: string; orderId: string } }>(
    "/trips/:tripId/deliver/:orderId",
    { preHandler: riderAuth },
    async (request, reply) => {
      const { tripId, orderId } = request.params;
      const user = getOrgUser(request);
      const body = (request.body ?? {}) as { collectedAmount?: number; codNote?: string };

      const trip = await app.prisma.deliveryTrip.findUnique({
        where: { id: tripId },
        include: { orders: { select: { id: true, status: true } } },
      });
      if (!trip) return reply.notFound("Trip not found");
      if (trip.riderId !== user.sub) return reply.forbidden("Not your trip");
      if (trip.status !== "IN_PROGRESS") return reply.badRequest("Trip is not in progress");

      const order = trip.orders.find((o) => o.id === orderId);
      if (!order) return reply.badRequest("Order not in this trip");
      if (order.status !== "OUT_FOR_DELIVERY") {
        return reply.badRequest(`Order is ${order.status}, expected OUT_FOR_DELIVERY`);
      }

      const result = await app.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "DELIVERED" },
        });
        // Build delivery note with COD info if applicable
        const noteParts = ["Delivered by rider"];
        if (body.collectedAmount != null) {
          noteParts.push(`COD collected: \u20B9${body.collectedAmount}`);
        }
        if (body.codNote) {
          noteParts.push(`Note: ${body.codNote}`);
        }
        await tx.orderStatusLog.create({
          data: { orderId, status: "DELIVERED", note: noteParts.join(". ") },
        });

        // Check if all orders in trip are now delivered
        const remaining = trip.orders.filter((o) => o.id !== orderId && o.status === "OUT_FOR_DELIVERY");
        if (remaining.length === 0) {
          await tx.deliveryTrip.update({
            where: { id: tripId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
          // Clean up location
          riderLocations.delete(tripId);
        }

        return { allDelivered: remaining.length === 0 };
      });

      // Broadcast order status update
      const { broadcastOrderUpdate } = await import("../../services/order-broadcast.js");
      broadcastOrderUpdate(app.prisma, orderId, "DELIVERED");

      // Notify trip subscribers that a stop was completed (triggers route re-fetch)
      broadcastToTripSubscribers(tripId, { type: "trip:stop_completed", tripId });

      // Invalidate route cache for this trip
      routeCache.delete(tripId);

      return { success: true, data: result };
    },
  );
}
