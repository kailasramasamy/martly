# Live Order Tracking

## Overview

Real-time rider GPS tracking during delivery. Three components work together:

1. **Rider App** (`apps/rider`) — Standalone Expo app for delivery riders. GPS broadcasting, trip management, order delivery.
2. **Backend** — In-memory location store, WebSocket relay for real-time updates, REST fallback endpoints.
3. **Customer App** — Live tracking map screen showing rider position, rider info, call button.

## Architecture

```
Rider App                    API Server                    Customer App
   │                            │                              │
   ├─ GPS watchPosition ──────► │ POST /rider-location         │
   │  (every 5s / 10m)          │   ├─ Store in memory         │
   │                            │   └─ Broadcast via WS ─────► │ MapView updates
   │                            │                              │
   ├─ WS: location:update ────► │ ─── WS: location:updated ──► │ Real-time pin
   │                            │                              │
   │                            │ GET /rider-location/by-order │
   │                            │   └─ REST fallback ─────────► │ Poll every 10s
```

## Rider App (`apps/rider/`)

### Tech Stack
- Expo 54 + Expo Router (file-based routing)
- Phone OTP login (same auth API as customer app)
- expo-location for GPS tracking
- WebSocket for location broadcasting

### Screens
| Screen | Path | Purpose |
|--------|------|---------|
| Login | `(auth)/login` | Phone OTP login |
| Deliveries | `(tabs)/index` | Today's trips list with stats |
| Profile | `(tabs)/profile` | Rider info, logout |
| Trip Detail | `trip/[id]` | Active delivery with GPS broadcasting |

### Trip Lifecycle
1. Admin assigns orders to rider via Delivery Board → creates trip (CREATED)
2. Rider opens trip → taps "Start Trip" → status becomes IN_PROGRESS
3. GPS broadcasting starts automatically (foreground, every 5s/10m)
4. Rider delivers each order → taps "Mark Delivered" with confirmation
5. When all orders delivered → trip auto-completes, GPS stops

### Brand
- Orange primary (`#f97316`) — distinct from customer app's teal
- Dark background for active delivery screen

### Running
```bash
pnpm --filter @martly/rider dev    # Port 8082
```

### Credentials
| User | Email | Password | Phone | OTP |
|------|-------|----------|-------|-----|
| Ravi Kumar | rider1@martly.dev | rider123 | 9876543210 | 111111 |
| Suresh Babu | rider2@martly.dev | rider123 | 9876543211 | 111111 |

## API Endpoints

### Rider Location

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/rider-location` | STAFF+ | Push GPS location for active trip |
| GET | `/api/v1/rider-location/:tripId` | AUTH | Get latest rider location by trip ID |
| GET | `/api/v1/rider-location/by-order/:orderId` | AUTH | Get rider tracking data by order (for customers) |
| GET | `/api/v1/rider-location/my-trips` | STAFF+ | Rider's trips for today |
| PATCH | `/api/v1/rider-location/trips/:tripId/deliver/:orderId` | STAFF+ | Mark order as delivered |

### WebSocket Events

**Client → Server:**
```json
{"type": "subscribe", "tripId": "..."}
{"type": "unsubscribe", "tripId": "..."}
{"type": "location:update", "tripId": "...", "lat": 12.97, "lng": 77.59, "heading": 90, "speed": 5.2}
```

**Server → Client:**
```json
{"type": "location:updated", "tripId": "...", "data": {"lat": 12.97, "lng": 77.59, "heading": 90, "speed": 5.2, "updatedAt": "..."}}
```

## Customer App — Live Tracking

### Screen: `apps/mobile/app/live-tracking.tsx`

- MapView with rider marker (bicycle icon), store marker (storefront icon)
- Pulsing "LIVE" indicator when WebSocket connected
- Bottom sheet: rider name, phone (tap to call), status, speed, last updated
- Delivery address with red dot
- WebSocket primary + 10s REST poll fallback

### Entry Point
Order detail screen shows **"Track Rider Live"** button when:
- Order status is `OUT_FOR_DELIVERY`
- Order has a `deliveryTripId`

## Location Storage

Rider locations are stored **in-memory** (Map keyed by tripId). This is intentional:
- GPS data is ephemeral — only needed during active delivery
- No historical tracking needed
- Auto-cleanup: stale locations (>10 min) are purged every 60s
- Trip completion clears the location entry

## Manual Verification

### 1. Setup
- Seed riders: `cd apps/api && npx tsx prisma/seed-rider.ts`
- Start API: `pnpm --filter @martly/api dev`
- Start customer mobile: `pnpm --filter @martly/mobile dev`
- Start rider app: `pnpm --filter @martly/rider dev`

### 2. Admin — Create a trip
- [x] Log in to admin panel as `admin@martly.dev`
- [x] Go to Delivery Board
- [ ] Find a READY order and create a trip with rider "Ravi Kumar"
- [ ] Verify trip appears as CREATED

### 3. Rider App — Start delivery
- [ ] Open rider app, log in with phone `9876543210` / OTP `111111`
- [ ] Deliveries tab shows today's stats and the new trip
- [ ] Tap the trip card → trip detail opens
- [ ] Trip shows CREATED status with "Start Trip" button
- [ ] Tap "Start Trip" → status changes to IN_PROGRESS
- [ ] GPS permission requested → grant
- [ ] Green pulsing "Broadcasting" indicator appears
- [ ] Order cards visible with customer name, address, amount

### 4. Customer — Track rider
- [ ] Open customer app, log in as `customer@martly.dev`
- [ ] Go to Orders tab, open the order that's OUT_FOR_DELIVERY
- [ ] "Track Rider Live" button visible (green with bicycle icon)
- [ ] Tap it → Live Tracking screen opens
- [ ] Map shows rider's current position (bicycle marker)
- [ ] Store marker visible (purple storefront)
- [ ] "LIVE" indicator pulsing in top-right corner
- [ ] Bottom sheet shows rider name, "On the way" status, speed
- [ ] Delivery address shown with red dot
- [ ] Tap phone icon → calls rider

### 5. Rider — Complete delivery
- [ ] Back in rider app, tap "Mark Delivered" on the order
- [ ] Confirmation alert appears → confirm
- [ ] Order card shows "Delivered" badge
- [ ] If all orders delivered: success alert, auto-navigate back
- [ ] GPS broadcasting stops

### 6. Customer — Verify delivery
- [ ] Order detail updates to DELIVERED status
- [ ] "Track Rider Live" button disappears
