# Real-Time Order Tracking (WebSocket)

## Overview

In-memory WebSocket pub/sub that broadcasts order updates to connected clients instantly. When an admin changes order status, both the mobile customer app and other admin panel users see the update in real-time.

```
Admin clicks "Confirm Order"
  → PATCH /api/v1/orders/:id/status (existing REST)
  → DB update + status log (existing)
  → FCM push notification (existing, for background)
  → WebSocket broadcast (NEW, for foreground)
  → Customer mobile + Admin panel receive instant update
```

## Architecture

**Server**: `@fastify/websocket` plugin with in-memory connection manager (no Redis).

Three tracking maps:
1. **orderSubscriptions**: `Map<orderId, Set<Client>>` — detail screen subscribers
2. **userConnections**: `Map<userId, Set<Client>>` — for customer list screen hints
3. **clients**: `Map<WebSocket, Client>` — for cleanup and admin broadcast

## Protocol

```
Client → Server:  { "type": "subscribe", "orderId": "abc-123" }
Client → Server:  { "type": "unsubscribe", "orderId": "abc-123" }
Client → Server:  { "type": "ping" }
Server → Client:  { "type": "pong" }
Server → Client:  { "type": "order:updated", "orderId": "abc-123", "data": { ...fullOrder } }
Server → Client:  { "type": "orders:changed", "orderId": "abc-123", "status": "CONFIRMED" }
```

- **order:updated** — full order data, sent to clients subscribed to a specific orderId (detail screens)
- **orders:changed** — lightweight hint, sent to user-level connections (list screens) and admin connections

## Connection

WebSocket endpoint: `ws://host:7001/ws?token=<JWT>`

JWT is verified on connect. Connection stays alive even if token expires (re-verified on reconnect).

## Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/ws-manager.ts` | In-memory connection manager |
| `apps/api/src/services/order-broadcast.ts` | Broadcasts order updates to all relevant clients |
| `apps/api/src/plugins/websocket.ts` | Fastify plugin: registers @fastify/websocket, `/ws` route with auth |
| `apps/mobile/lib/useOrderWebSocket.ts` | React Native hook with auto-reconnect |
| `apps/admin/src/hooks/useOrderWebSocket.ts` | Browser hook with auto-reconnect |

## Broadcast Triggers

Three places in `apps/api/src/routes/orders/index.ts`:
1. `PATCH /:id/status` — admin status change
2. `POST /:id/cancel` — customer self-cancel
3. `POST /:id/payment/verify` — payment verified (auto-confirms)

## Reconnection

Exponential backoff: 1s → 2s → 4s → 8s → ... → max 30s. Resets on successful connect.

- Mobile: reconnects on AppState change (foreground)
- Admin: reconnects on `visibilitychange` (tab focus)
- Both: 60s fallback poll as safety net

## Testing

```bash
# Get a token
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@martly.dev","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Connect via wscat
wscat -c "ws://localhost:7001/ws?token=$TOKEN"

# Subscribe to an order
> {"type":"subscribe","orderId":"<order-id>"}

# In another terminal, change the order status
curl -X PATCH http://localhost:7001/api/v1/orders/<order-id>/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONFIRMED"}'

# You should see the order:updated and orders:changed messages in wscat
```

## What Was Tested

- WebSocket connect/disconnect lifecycle
- Ping/pong heartbeat
- Order subscription and broadcast delivery
- Customer receives both `order:updated` (detail) and `orders:changed` (list)
- Admin receives `orders:changed` on status change
- Admin TypeScript compilation passes

## What Needs Manual Verification

- Mobile app: open order detail → change status from admin → verify instant update
- Mobile app: open orders tab → change status → verify list refreshes
- Admin panel: open order in two tabs → change from one → verify other updates
- Kill and restart API server → verify clients reconnect
- Background mobile app → change status → verify FCM push still works
