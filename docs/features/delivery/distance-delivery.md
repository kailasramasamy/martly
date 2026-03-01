# Distance-Based Delivery Serviceability

## How It Works

### Overview
Delivery serviceability uses **distance-based tiers per store** instead of PIN-code zones. Each store has GPS coordinates and a delivery radius. Delivery tiers define fee/time bands within that radius using Haversine distance calculation.

### Flow
1. Store admin sets store coordinates (lat/lng) and delivery radius (km)
2. Admin creates delivery tiers (e.g., 0–3km = free, 3–5km = ₹20, 5–7km = ₹40)
3. Customer addresses store lat/lng (from Google geocoding or manual input)
4. On checkout, the app calls `POST /delivery-tiers/lookup` with store + address coordinates
5. Server calculates Haversine distance → finds matching tier → returns fee + ETA
6. If outside radius or no matching tier → returns `serviceable: false`
7. Order creation validates serviceability and stores `deliveryDistance` on the order

### Backward Compatibility
- Old DeliveryZone/StoreDeliveryZone tables kept intact
- Order creation falls back to zone-based fee if no distance tier matches
- The delivery-zones lookup endpoint still works

## Database Changes

### New fields
- `stores.latitude`, `stores.longitude`, `stores.delivery_radius` (default 7 km)
- `user_addresses.latitude`, `user_addresses.longitude`, `user_addresses.pincode`
- `orders.delivery_distance` (km at time of order)

### New table: `delivery_tiers`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| store_id | UUID | FK → stores |
| min_distance | Float | Start of range (km) |
| max_distance | Float | End of range (km) |
| delivery_fee | Decimal(10,2) | Fee for this tier |
| estimated_minutes | Int | Estimated delivery time |
| is_active | Boolean | Whether this tier is active |

## API Endpoints

### Delivery Tiers (`/api/v1/delivery-tiers`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/?storeId=X` | Admin | List tiers for a store |
| GET | `/:id` | Admin | Get single tier |
| POST | `/` | Admin | Create tier (validates overlap) |
| PUT | `/:id` | Admin | Update tier |
| DELETE | `/:id` | Admin | Delete tier |
| POST | `/lookup` | Public | Serviceability check |

### Lookup request/response
```json
// POST /api/v1/delivery-tiers/lookup
{ "storeId": "...", "latitude": 12.97, "longitude": 77.64 }

// Serviceable response
{ "serviceable": true, "distance": 4.43, "deliveryFee": 20, "estimatedMinutes": 45 }

// Not serviceable response
{ "serviceable": false, "distance": 12.48, "reason": "Too far from store" }
```

### Store nearby (`/api/v1/stores/nearby`)
```
GET /api/v1/stores/nearby?lat=12.9&lng=77.6&radius=10
```
Returns active stores with coordinates, sorted by distance.

## What Was Tested

1. ✅ Migration runs cleanly, Prisma client generated
2. ✅ Store coordinates saved and returned in GET
3. ✅ Delivery tiers CRUD with overlap validation
4. ✅ Lookup within 0–3km → FREE, 30 min
5. ✅ Lookup within 3–5km → ₹20, 45 min
6. ✅ Lookup within 5–7km → ₹40, 60 min
7. ✅ Lookup outside radius → not serviceable
8. ✅ Overlapping tier creation → rejected
9. ✅ Nearby stores endpoint returns stores sorted by distance
10. ✅ Customer address has lat/lng/pincode

## Seed Data
- **Bigmart**: 12.9352, 77.6245 (Koramangala, Bangalore), radius 7km
- **Tiers**: 0–3km FREE/30min, 3–5km ₹20/45min, 5–7km ₹40/60min
- **Test customer address**: 12.9716, 77.6412 (Indiranagar, ~4.4km from store)

Run seed: `cd apps/api && npx tsx prisma/seed-delivery-tiers.ts`

## Manual Verification Needed

1. **Admin panel**: Visit `/delivery-tiers` → select Bigmart → verify 3 tiers show
2. **Admin panel**: Edit Bigmart store → verify lat/lng/radius fields visible
3. **Mobile app**: Checkout with customer address → verify distance-based fee shown
4. **Mobile app**: Verify "Delivery not available" warning for out-of-range addresses
5. **Google Maps geocoding**: Set `GOOGLE_MAPS_API_KEY` env var to enable auto-geocoding of addresses
