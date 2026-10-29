import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { JwtUser } from "../types/jwt.js";
import { tokenKind } from "../middleware/auth.js";
import { canWatchOrder, canWatchTrip } from "../services/ws-access.js";
import { registerClient, removeClient, subscribeToOrder, unsubscribeFromOrder, subscribeToTrip, unsubscribeFromTrip } from "../services/ws-manager.js";

interface WsMessage {
  type?: string;
  orderId?: unknown;
  tripId?: unknown;
}

const idOf = (value: unknown) => (typeof value === "string" && value ? value : null);

/** A subscribe is honoured only for an order or trip the user may see; anything else is ignored */
async function handleMessage(app: FastifyInstance, socket: WebSocket, request: FastifyRequest, msg: WsMessage) {
  const orderId = idOf(msg.orderId);
  const tripId = idOf(msg.tripId);
  switch (msg.type) {
    case "subscribe":
      if (orderId && (await canWatchOrder(request, app.prisma, orderId))) subscribeToOrder(socket, orderId);
      if (tripId && (await canWatchTrip(request, app.prisma, tripId))) subscribeToTrip(socket, tripId);
      break;
    case "unsubscribe":
      if (orderId) unsubscribeFromOrder(socket, orderId);
      if (tripId) unsubscribeFromTrip(socket, tripId);
      break;
    case "ping":
      socket.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

function parseMessage(raw: unknown): WsMessage | null {
  try {
    const msg: unknown = JSON.parse(String(raw));
    return msg && typeof msg === "object" ? (msg as WsMessage) : null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

export const websocketPlugin = fp(async (app: FastifyInstance) => {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket, request) => {
    // Browsers can't set headers on a WebSocket, so the access token comes in the query string (redacted from logs)
    const token = new URL(request.url, "http://localhost").searchParams.get("token");
    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let payload: JwtUser;
    try {
      payload = app.jwt.verify<JwtUser>(token);
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }
    if (tokenKind(payload) !== "access") {
      socket.close(4001, "Invalid token");
      return;
    }
    // The org-scope helpers read the user from the request
    request.user = payload;

    registerClient(socket, payload.sub, payload.role, payload.organizationId);
    app.log.info({ userId: payload.sub, role: payload.role }, "WebSocket client connected");

    socket.on("message", (raw) => {
      const msg = parseMessage(raw);
      if (!msg) return;
      handleMessage(app, socket, request, msg).catch((err) => app.log.warn({ err, userId: payload.sub }, "WebSocket message failed"));
    });

    socket.on("close", () => {
      removeClient(socket);
      app.log.info({ userId: payload.sub }, "WebSocket client disconnected");
    });
  });
});
