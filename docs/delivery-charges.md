# Delivery Charges

A store's delivery charges are set in one place, **Delivery charges**:

- Admin: Delivery → Delivery charges (`/delivery-tiers`)
- Manage app: Delivery setup → Delivery charges

It holds:

| Setting | Where it's stored | What it does |
|---|---|---|
| **Distance tiers** | `delivery_tiers` (per store) | The delivery fee and ETA by the customer's distance from the store, e.g. 0–2 km ₹20, 2–4 km ₹30, 4–6 km ₹40. **The only source of a delivery fee.** |
| **Delivery radius** | `stores.delivery_radius` | Addresses farther than this can't order delivery |
| **Free delivery above** | `stores.free_delivery_threshold` | Item total at or above this waives the fee (empty = never) |
| **Minimum order** | `stores.min_order_amount` | Orders below this are refused (empty = no minimum) |

There is no store-level base fee (dropped on 2026-10-29, migration `20261029120000_drop_store_base_delivery_fee`). A store with one flat fee has a single tier across its radius.

Delivery Zones (pincodes) still exist but **don't set fees**. They're kept for pincode-based delivery later and are hidden from the admin sidebar and Manage menu.

## How the fee is worked out

`deliveryFeeTo()` in `apps/api/src/services/delivery/fee.ts` is the single function. Everything uses it:

- checkout's lookup `POST /delivery-tiers/lookup`
- placing an order (`POST /orders`)
- monthly-list quick order
- subscription deliveries (scheduler) and the Tomorrow's Basket preview, by the subscription's saved address
- store picking ("delivers to you") follows the same rule

Rules:

1. Distance = straight line from the store to the address.
2. Beyond the radius → not serviceable ("Too far from store").
3. The active tier covering the distance sets the fee and ETA. No tier covers it → not serviceable.
4. If the store or address has no location, the nearest tier applies.
5. Afterwards, the order waives the fee for the free-delivery threshold or a membership with free delivery. Pickup is always free.

A placed order keeps the fee it was charged; changing tiers only affects new orders.

## API

| Endpoint | Who | What |
|---|---|---|
| `GET/POST/PUT/DELETE /delivery-tiers` | DELIVERY_CONFIG | Tiers for a store (no overlaps) |
| `GET /delivery-tiers/settings?storeId=` | DELIVERY_CONFIG or STORE_SETTINGS | `{ deliveryRadius, freeDeliveryThreshold, minOrderAmount }` |
| `PUT /delivery-tiers/settings?storeId=` | DELIVERY_CONFIG | Saves them (`deliveryChargesSchema` in shared) |
| `POST /delivery-tiers/lookup` | public | `{ serviceable, deliveryFee, estimatedMinutes, distance, reason }` for a point |

The store create/update schemas no longer take radius, minimum order or free-delivery threshold. A store created from admin starts with one ₹0 tier across its radius so it can deliver. Store onboarding takes a `startingDeliveryFee` that seeds three tiers (farther tiers add ₹10 each); it isn't stored on the store.

Store payloads (`GET /stores`, `/stores/resolve`, `/stores/nearby`) carry `deliveryFeeFrom`, the lowest active tier fee.

## Customer app

- **Cart:** delivery line shows "from ₹20" (`deliveryFeeFrom`), "Free" when the threshold, membership or a ₹0 tier makes it free. The grand total includes the "from" fee; checkout shows the exact one.
- **Checkout:** the fee comes from the address lookup; until an address is looked up it shows "from ₹20". No zone or base-fee fallback.
- Nudges: "Add ₹X more to place your order" below the minimum, "Add ₹X more for free delivery" below the threshold.

Old app builds read `baseDeliveryFee` in Cart; with it gone they show no delivery line until updated. Their checkout already uses the lookup, so the charged fee is right.

## What was tested (local, 2026-10-29)

- Lookup at 1 / 2.5 / 4 / 6 km from Sree Ranga → ₹20 / ₹30 / ₹40 / "Too far from store"
- COD orders at 1 / 3 / 5 km from The Fresh Pantry (tiers set to 20/30/40) → order `deliveryFee` 20 / 30 / 40; 7 km refused with the radius message
- Free-delivery threshold set through `PUT /settings` → order at 3 km charged ₹0
- Settings GET/PUT, validation (radius 0 refused)
- New store via `POST /stores` gets a 0–7 km ₹0 tier
- Store list returns `deliveryFeeFrom` and no `baseDeliveryFee`; onboarding details return `startingDeliveryFee`
- API, admin and mobile type-check (unrelated AI-image errors aside)

## Needs manual checking

- Admin → Delivery charges: settings form loads, saves, and the zones item is gone from the sidebar
- Manage → Delivery charges: "Radius, free delivery & minimum order" row opens the form and saves
- Admin store edit/create and the Manage store form no longer show delivery fields
- Cart shows "from ₹X"; checkout fee changes with the chosen address
- A subscription delivery is charged by its address's tier
