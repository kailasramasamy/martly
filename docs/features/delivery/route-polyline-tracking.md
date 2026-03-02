# Route Polyline on Live Tracking

Uber-style route visualization on the customer live-tracking screen. Shows the full remaining delivery path from rider through all undelivered stops to the customer's stop.

## How It Works

### Multi-Stop Route
When a delivery trip has multiple orders, the customer sees:
- A teal polyline on the map showing the full driving route
- Numbered stop markers (gray for other stops, red for their stop)
- "You're stop X of Y" pill indicator
- Estimated time of arrival

### Server-Side Directions
- Route is computed server-side using Google Routes API
- Google API key stays secure on the server (never exposed to mobile)
- Routes are cached in-memory per trip: reuses cache if <60s old, rider moved <500m, and same stop count
- Typically ~2-4 API calls per trip, not one per GPS tick

### Delivery Sequence
- When a trip is created, each order gets a `deliverySequence` (1, 2, 3...)
- This determines the delivery order and route waypoints
- Sequence is set from the order array passed to the create-trip endpoint

## API Endpoints

### `GET /api/v1/rider-location/by-order/:orderId`
Updated to return additional fields:
- `deliveryLat`, `deliveryLng` — customer's delivery coordinates
- `remainingStops` — array of `{ sequence, lat, lng, isYourStop }` (anonymized, no PII)
- `customerStopNumber` — which stop number the customer is
- `totalStops` — total remaining stops in the trip

### `GET /api/v1/rider-location/route/by-order/:orderId`
New endpoint returning:
- `polyline` — array of `{ lat, lng }` coordinates for the route
- `legs` — array of `{ durationSeconds, distanceMeters }` per segment
- `totalDurationSeconds`, `totalDistanceMeters` — route totals

Returns `null` if: no rider location yet, no delivery coordinates, or Google API unavailable (graceful degradation).

### WebSocket: `trip:stop_completed`
Broadcast to all trip subscribers when a rider marks an order as delivered. Mobile client re-fetches both tracking data and route on this event.

## Schema Change

```sql
ALTER TABLE "orders" ADD COLUMN "delivery_sequence" INTEGER;
```

## Files Changed

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added `deliverySequence` to Order |
| `apps/api/src/routes/delivery-trips/index.ts` | Set sequence on trip creation |
| `apps/api/src/routes/rider-location/index.ts` | Updated by-order response, added route endpoint, broadcast on deliver |
| `apps/api/src/lib/geo.ts` | Added `decodePolyline()` and `getDirectionsRoute()` |
| `apps/api/src/services/ws-manager.ts` | Added `broadcastToTripSubscribers()` |
| `apps/mobile/app/live-tracking.tsx` | Polyline, stop markers, route fetch, ETA, stop indicator |

## Prerequisites

Google Routes API must be enabled in the Google Cloud console for the project associated with `GOOGLE_MAPS_API_KEY`. Without it, the map still works — just no route polyline or ETA.

## Testing

```bash
# Push rider location
RIDER_TOKEN=$(curl -s http://localhost:7001/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543221","otp":"111111"}' | jq -r '.data.accessToken')

curl -s -X POST http://localhost:7001/api/v1/rider-location \
  -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"tripId":"<TRIP_ID>","lat":12.935,"lng":77.624}'

# Fetch tracking with stops
CUST_TOKEN=$(curl -s http://localhost:7001/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"5555555555","otp":"111111"}' | jq -r '.data.accessToken')

curl -s http://localhost:7001/api/v1/rider-location/by-order/<ORDER_ID> \
  -H "Authorization: Bearer $CUST_TOKEN" | jq .

# Fetch route polyline
curl -s http://localhost:7001/api/v1/rider-location/route/by-order/<ORDER_ID> \
  -H "Authorization: Bearer $CUST_TOKEN" | jq .
```
