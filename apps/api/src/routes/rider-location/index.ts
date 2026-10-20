import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { broadcastRiderLocation } from "../../services/ws-manager.js";
import { haversine, getDirectionsRoute } from "../../lib/geo.js";
import { notifyIfRiderNearby } from "../../services/notify/delivery-alerts.js";
import { cacheRoute, cachedRoute, riderLocation, setRiderLocation } from "../../services/delivery/live-location.js";

const riderAuth = [authenticate, requirePermission(Permission.DELIVERY_DELIVER)];

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
    setRiderLocation(location);

    // Broadcast to subscribed customers via WebSocket
    broadcastRiderLocation(tripId, {
      lat,
      lng,
      heading,
      speed,
      updatedAt: location.updatedAt,
    });

    notifyIfRiderNearby(app.fcm, app.prisma, tripId, lat, lng).catch((err: unknown) => app.log.error(err, "Rider nearby notification failed"));

    return { success: true, data: { received: true } } satisfies ApiResponse<{ received: true }>;
  });

  /**
   * GET /rider-location/:tripId
   * Customer fetches the latest known rider location for a trip.
   */
  app.get<{ Params: { tripId: string } }>("/:tripId", { preHandler: [authenticate] }, async (request, reply) => {
    const { tripId } = request.params;
    const user = getOrgUser(request);

    // Customers need an order in this trip; staff need access to the trip's store
    if (user.role === "CUSTOMER") {
      const orderInTrip = await app.prisma.order.findFirst({
        where: { deliveryTripId: tripId, userId: user.sub },
        select: { id: true },
      });
      if (!orderInTrip) return reply.forbidden("Access denied");
    } else {
      const trip = await app.prisma.deliveryTrip.findUnique({ where: { id: tripId }, select: { storeId: true } });
      if (!trip || !(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) return reply.forbidden("Access denied");
    }

    const location = riderLocation(tripId);
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
          storeId: true,
          status: true,
          deliveryTripId: true,
          deliveryAddress: true,
          deliveryLat: true,
          deliveryLng: true,
          deliverySequence: true,
          store: { select: { name: true, translations: true, latitude: true, longitude: true } },
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
      const allowed = user.role === "CUSTOMER"
        ? order.userId === user.sub
        : await verifyStoreOrgAccess(request, app.prisma, order.storeId);
      if (!allowed) return reply.forbidden("Access denied");

      if (!order.deliveryTripId || !order.deliveryTrip) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      const location = riderLocation(order.deliveryTripId);

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
          storeId: true,
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
      const allowed = user.role === "CUSTOMER"
        ? order.userId === user.sub
        : await verifyStoreOrgAccess(request, app.prisma, order.storeId);
      if (!allowed) return reply.forbidden("Access denied");
      if (!order.deliveryTripId || !order.deliveryTrip) {
        return { success: true, data: null } satisfies ApiResponse<null>;
      }

      const tripId = order.deliveryTrip.id;
      const riderLoc = riderLocation(tripId);
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
      const cached = cachedRoute(tripId);
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
      cacheRoute(tripId, {
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
   * GET /rider-location/trips/:tripId/route
   * ETAs for a trip's remaining stops, in their planned order: from the rider's live position, or from the store
   * until the rider shares one. For the trip's rider and for staff of its store.
   */
  app.get<{ Params: { tripId: string } }>("/trips/:tripId/route", { preHandler: [authenticate] }, async (request, reply) => {
    const trip = await app.prisma.deliveryTrip.findUnique({
      where: { id: request.params.tripId },
      select: {
        id: true, riderId: true, storeId: true, status: true,
        store: { select: { latitude: true, longitude: true } },
        orders: { where: { status: { in: ["READY", "OUT_FOR_DELIVERY"] } }, orderBy: { deliverySequence: "asc" }, select: { id: true, deliveryLat: true, deliveryLng: true } },
      },
    });
    if (!trip) return reply.notFound("Trip not found");
    const own = trip.riderId === request.user.sub;
    if (!own && !(await verifyStoreOrgAccess(request, app.prisma, trip.storeId))) return reply.forbidden("Access denied");

    const live = trip.status === "IN_PROGRESS" ? riderLocation(trip.id) : undefined;
    const origin = live ? { lat: live.lat, lng: live.lng } : trip.store.latitude != null && trip.store.longitude != null ? { lat: trip.store.latitude, lng: trip.store.longitude } : null;
    const located = trip.orders.filter((o) => o.deliveryLat != null && o.deliveryLng != null);
    if (!origin || located.length === 0) return { success: true, data: null } satisfies ApiResponse<null>;

    const cached = cachedRoute(trip.id);
    const fresh = cached && Date.now() - cached.cachedAt < 60_000 && cached.stopCount === located.length
      && haversine(cached.originLat, cached.originLng, origin.lat, origin.lng) < 0.3;
    const points = located.map((o) => ({ lat: o.deliveryLat as number, lng: o.deliveryLng as number }));
    const route = fresh ? cached.result : await getDirectionsRoute(origin, points[points.length - 1], points.slice(0, -1));
    if (!route) return { success: true, data: null } satisfies ApiResponse<null>;
    if (!fresh) cacheRoute(trip.id, { result: route, originLat: origin.lat, originLng: origin.lng, stopCount: located.length, cachedAt: Date.now() });

    let elapsed = 0;
    let travelled = 0;
    const stops = located.map((o, i) => {
      elapsed += route.legs[i]?.durationSeconds ?? 0;
      travelled += route.legs[i]?.distanceMeters ?? 0;
      return { orderId: o.id, etaSeconds: elapsed, distanceMeters: travelled };
    });
    const data = { from: live ? "rider" as const : "store" as const, stops, totalSeconds: route.totalDurationSeconds, totalMeters: route.totalDistanceMeters, polyline: route.polyline };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });
}
