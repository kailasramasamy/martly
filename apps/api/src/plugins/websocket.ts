import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { registerClient, removeClient, subscribeToOrder, unsubscribeFromOrder } from "../services/ws-manager.js";

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
            break;
          case "unsubscribe":
            if (msg.orderId) unsubscribeFromOrder(socket, msg.orderId);
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
