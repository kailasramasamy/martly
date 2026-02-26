# Home Delivery + Store Pickup Fulfillment

## Overview

Orders now support two fulfillment types: **Home Delivery** (default) and **Store Pickup**. Customers within the delivery radius see both options; those outside see only Store Pickup with a helpful explanation.

## How It Works

### Database
- `FulfillmentType` enum: `DELIVERY`, `PICKUP`
- `Order.fulfillmentType` field (default `DELIVERY`) — backward compatible with all existing orders
- `Order.deliveryAddress` is now nullable (pickup orders store the store address for reference)

### API Changes

**`POST /api/v1/delivery-tiers/lookup`** — Enhanced response:
- Always includes `pickupAvailable: true`, `storeName`, `storeAddress`
- Non-serviceable responses include store info so mobile can show pickup fallback

**`POST /api/v1/orders`** — Accepts `fulfillmentType`:
- `PICKUP`: skips address requirement, `deliveryFee = 0`, stores store address, 30-min estimated prep time
- `DELIVERY`: existing distance-based logic unchanged (rejects if outside radius)

**`PATCH /api/v1/orders/:id/status`** — Pickup-aware transitions:
- Delivery: READY → OUT_FOR_DELIVERY → DELIVERED
- Pickup: READY → DELIVERED (skips OUT_FOR_DELIVERY)

**`GET /api/v1/orders`** — New `fulfillmentType` query param for filtering

### Mobile Checkout
- Fulfillment selector with two cards (Home Delivery / Store Pickup)
- Smart defaulting: auto-selects Pickup when delivery unavailable
- Pickup shows store name + address card; delivery shows address selection
- Bill details adapt: "Store pickup: FREE" vs delivery fee
- Order payload includes `fulfillmentType`

### Mobile Order Detail + List
- Status timeline skips OUT_FOR_DELIVERY step for pickup orders
- Labels: "Ready for Pickup", "Picked Up" (instead of "Ready", "Delivered")
- Address section: "Pickup Location" vs "Delivery Address"
- Orders list shows pickup badge indicator

### Admin Panel
- Orders list: Fulfillment column with Delivery/Pickup tags + filter dropdown
- Order show: Fulfillment row in summary, pickup-aware status buttons ("Mark Picked Up" vs "Mark Delivered"), pickup-aware address label

## What Was Tested

- Pickup order creation (no address, fee = 0) ✓
- Delivery order creation (existing flow unchanged) ✓
- Pickup: READY → DELIVERED works directly ✓
- Pickup: READY → OUT_FOR_DELIVERY blocked ✓
- Delivery: READY → OUT_FOR_DELIVERY → DELIVERED unchanged ✓
- Delivery: READY → DELIVERED blocked ✓
- Delivery lookup returns pickupAvailable + store info ✓
- Fulfillment type filter on orders list ✓
- Existing orders default to DELIVERY ✓

## Manual Verification Needed

1. **Mobile checkout flow**: Open the checkout screen with items in cart, verify both fulfillment cards appear, test switching between them
2. **Mobile outside-radius flow**: Use an address far from the store, verify delivery card is disabled and pickup is auto-selected
3. **Admin orders list**: Verify the Fulfillment column shows correctly, test the fulfillment filter dropdown
4. **Admin order show**: View a pickup order, verify "Mark Picked Up" button appears at READY state, verify "Pickup Location" label
