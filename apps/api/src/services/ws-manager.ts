import type { WebSocket } from "ws";

export interface WsClient {
  ws: WebSocket;
  userId: string;
  role: string;
  organizationId?: string;
  subscribedOrders: Set<string>;
}

// Three tracking maps
const orderSubscriptions = new Map<string, Set<WsClient>>();
const userConnections = new Map<string, Set<WsClient>>();
const clients = new Map<WebSocket, WsClient>();

export function registerClient(ws: WebSocket, userId: string, role: string, organizationId?: string): WsClient {
  const client: WsClient = { ws, userId, role, organizationId, subscribedOrders: new Set() };
  clients.set(ws, client);

  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(client);

  return client;
}

export function removeClient(ws: WebSocket) {
  const client = clients.get(ws);
  if (!client) return;

  // Remove from order subscriptions
  for (const orderId of client.subscribedOrders) {
    const subs = orderSubscriptions.get(orderId);
    if (subs) {
      subs.delete(client);
      if (subs.size === 0) orderSubscriptions.delete(orderId);
    }
  }

  // Remove from user connections
  const userConns = userConnections.get(client.userId);
  if (userConns) {
    userConns.delete(client);
    if (userConns.size === 0) userConnections.delete(client.userId);
  }

  clients.delete(ws);
}

export function subscribeToOrder(ws: WebSocket, orderId: string) {
  const client = clients.get(ws);
  if (!client) return;

  client.subscribedOrders.add(orderId);
  if (!orderSubscriptions.has(orderId)) {
    orderSubscriptions.set(orderId, new Set());
  }
  orderSubscriptions.get(orderId)!.add(client);
}

export function unsubscribeFromOrder(ws: WebSocket, orderId: string) {
  const client = clients.get(ws);
  if (!client) return;

  client.subscribedOrders.delete(orderId);
  const subs = orderSubscriptions.get(orderId);
  if (subs) {
    subs.delete(client);
    if (subs.size === 0) orderSubscriptions.delete(orderId);
  }
}

function send(client: WsClient, data: unknown) {
  if (client.ws.readyState === client.ws.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

/** Send full order data to clients subscribed to a specific orderId */
export function broadcastToOrderSubscribers(orderId: string, orderData: unknown) {
  const subs = orderSubscriptions.get(orderId);
  if (!subs) return;
  const message = { type: "order:updated", orderId, data: orderData };
  for (const client of subs) {
    send(client, message);
  }
}

/** Send lightweight hint to all connections for a specific user (list screens) */
export function broadcastToUser(userId: string, orderId: string, status: string) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  const message = { type: "orders:changed", orderId, status };
  for (const client of conns) {
    send(client, message);
  }
}

/** Send a notification event to all connections for a specific user */
export function broadcastNotification(userId: string, notification: unknown) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  const message = { type: "notification:new", data: notification };
  for (const client of conns) {
    send(client, message);
  }
}

// ── Trip location tracking ───────────────────────
const tripSubscriptions = new Map<string, Set<WsClient>>();

export function subscribeToTrip(ws: WebSocket, tripId: string) {
  const client = clients.get(ws);
  if (!client) return;
  if (!tripSubscriptions.has(tripId)) {
    tripSubscriptions.set(tripId, new Set());
  }
  tripSubscriptions.get(tripId)!.add(client);
}

export function unsubscribeFromTrip(ws: WebSocket, tripId: string) {
  const client = clients.get(ws);
  if (!client) return;
  const subs = tripSubscriptions.get(tripId);
  if (subs) {
    subs.delete(client);
    if (subs.size === 0) tripSubscriptions.delete(tripId);
  }
}

/** Send a generic message to all clients subscribed to a trip */
export function broadcastToTripSubscribers(tripId: string, message: unknown) {
  const subs = tripSubscriptions.get(tripId);
  if (!subs) return;
  for (const client of subs) {
    send(client, message);
  }
}

/** Send rider location update to clients subscribed to a trip */
export function broadcastRiderLocation(tripId: string, location: { lat: number; lng: number; heading?: number; speed?: number; updatedAt: string }) {
  const subs = tripSubscriptions.get(tripId);
  if (!subs) return;
  const message = { type: "location:updated", tripId, data: location };
  for (const client of subs) {
    send(client, message);
  }
}

/** Send lightweight hint to all admin connections for an org (or all for SUPER_ADMIN) */
export function broadcastToAdmins(organizationId: string | null, orderId: string, status: string) {
  const message = { type: "orders:changed", orderId, status };
  for (const client of clients.values()) {
    if (client.role === "CUSTOMER") continue;
    // SUPER_ADMIN sees all; org-scoped admins see their org's orders
    if (client.role === "SUPER_ADMIN" || client.organizationId === organizationId) {
      send(client, message);
    }
  }
}
