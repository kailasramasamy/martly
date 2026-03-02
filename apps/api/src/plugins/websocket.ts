import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { registerClient, removeClient, subscribeToOrder, unsubscribeFromOrder, subscribeToTrip, unsubscribeFromTrip, broadcastRiderLocation } from "../services/ws-manager.js";
import { storeRiderLocation } from "../routes/rider-location/index.js";

export const websocketPlugin = fp(async (app: FastifyInstance) => {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket, request) => {
    // Authenticate via query param token
    const url = new URL(request.url, "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let payload: { sub: string; role: string; organizationId?: string };
    try {
      payload = app.jwt.verify<{ sub: string; role: string; organizationId?: string }>(token);
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    const client = registerClient(socket, payload.sub, payload.role, payload.organizationId);
    app.log.info({ userId: payload.sub, role: payload.role }, "WebSocket client connected");

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "subscribe":
            if (msg.orderId) subscribeToOrder(socket, msg.orderId);
            if (msg.tripId) subscribeToTrip(socket, msg.tripId);
            break;
          case "unsubscribe":
            if (msg.orderId) unsubscribeFromOrder(socket, msg.orderId);
            if (msg.tripId) unsubscribeFromTrip(socket, msg.tripId);
            break;
          case "location:update":
            // Rider broadcasting their GPS position
            if (msg.tripId && msg.lat != null && msg.lng != null) {
              const updatedAt = new Date().toISOString();
              // Store in memory so REST polling also returns the latest location
              storeRiderLocation(msg.tripId, {
                riderId: payload.sub,
                lat: msg.lat,
                lng: msg.lng,
                heading: msg.heading,
                speed: msg.speed,
                updatedAt,
              });
              broadcastRiderLocation(msg.tripId, {
                lat: msg.lat,
                lng: msg.lng,
                heading: msg.heading,
                speed: msg.speed,
                updatedAt,
              });
            }
            break;
          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on("close", () => {
      removeClient(socket);
      app.log.info({ userId: payload.sub }, "WebSocket client disconnected");
    });
  });
});
