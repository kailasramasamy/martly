# Minimum Order Amount & Free Delivery Threshold

## Overview

Stores can optionally set three delivery/order fields:
- **Minimum order amount** — orders below this are rejected
- **Base delivery fee** — flat delivery fee charged when no distance tier or zone matches
- **Free delivery threshold** — orders above this amount get free delivery (waives the fee)

All fields are nullable (no minimum / no fee / no threshold by default).

## Schema

Three `Decimal?` fields on the `Store` model:
- `minOrderAmount` (`min_order_amount`)
- `baseDeliveryFee` (`base_delivery_fee`)
- `freeDeliveryThreshold` (`free_delivery_threshold`)

## How It Works

### Delivery Fee Resolution Order

1. **Distance-based tier** — if the customer address matches a delivery tier, use the tier fee
2. **Zone-based** — if no tier matched, use the delivery zone fee
3. **Store base fee** — if neither tier nor zone returned a fee, use `baseDeliveryFee`
4. **Free delivery override** — if `freeDeliveryThreshold` is set and `itemsTotal >= threshold`, fee is waived to **0**

### API (Order Creation)
1. After computing `itemsTotal`, rejects with **400** if below `store.minOrderAmount`.
2. Computes delivery fee via tiers → zones → `baseDeliveryFee` fallback.
3. If `freeDeliveryThreshold` is met, overrides delivery fee to **0**.

### Admin Panel
Store create/edit forms have an "Order & Delivery" card with:
- Min Order Amount (₹)
- Base Delivery Fee (₹)
- Free Delivery Threshold (₹)

### Mobile App

**Cart Screen:**
- Bill details show `baseDeliveryFee` when set (e.g. "₹30"), "FREE" when threshold met, "At checkout" otherwise
- **Below minimum** (orange nudge): "Add ₹X more to place your order (min ₹Y)"
- **Below free delivery** (teal nudge): "Add ₹X more for free delivery"
- Checkout button **disabled** when below minimum

**Checkout Screen:**
- Warning banner when below minimum
- Delivery fee shows the resolved fee (tier > zone > base fee)
- Strikethrough + "FREE" when free delivery threshold is met
- Place order button disabled when below minimum

## Test Data

Bigmart store is seeded with:
- `minOrderAmount`: ₹199
- `baseDeliveryFee`: ₹30
- `freeDeliveryThreshold`: ₹499

---

## Test Steps

### 1. API — Verify store fields

```bash
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@martly.dev","password":"admin123"}' | jq -r '.data.accessToken')
STORE_ID="375d5737-069b-42f0-9791-1cc8390c0993"

# GET store — should include all 3 fields
curl -s "http://localhost:7001/api/v1/stores/$STORE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{name: .data.name, minOrderAmount: .data.minOrderAmount, baseDeliveryFee: .data.baseDeliveryFee, freeDeliveryThreshold: .data.freeDeliveryThreshold}'
# Expected: { "name": "Bigmart", "minOrderAmount": "199", "baseDeliveryFee": "30", "freeDeliveryThreshold": "499" }
```

### 2. API — Update thresholds

```bash
# Set all 3 fields
curl -s -X PUT "http://localhost:7001/api/v1/stores/$STORE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"minOrderAmount": 199, "baseDeliveryFee": 30, "freeDeliveryThreshold": 499}' \
  | jq '{success: .success, minOrderAmount: .data.minOrderAmount, baseDeliveryFee: .data.baseDeliveryFee, freeDeliveryThreshold: .data.freeDeliveryThreshold}'

# Clear all (set to null)
curl -s -X PUT "http://localhost:7001/api/v1/stores/$STORE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"minOrderAmount": null, "baseDeliveryFee": null, "freeDeliveryThreshold": null}' \
  | jq '{success: .success, minOrderAmount: .data.minOrderAmount, baseDeliveryFee: .data.baseDeliveryFee, freeDeliveryThreshold: .data.freeDeliveryThreshold}'

# Re-set for remaining tests
curl -s -X PUT "http://localhost:7001/api/v1/stores/$STORE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"minOrderAmount": 199, "baseDeliveryFee": 30, "freeDeliveryThreshold": 499}' > /dev/null
```

### 3. API — Min order rejection

```bash
CUST_TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@martly.dev","password":"customer123"}' | jq -r '.data.accessToken')

# Find a cheap product
SP_ID=$(curl -s "http://localhost:7001/api/v1/store-products?storeId=$STORE_ID&pageSize=1&sortBy=price&sortOrder=asc" \
  -H "Authorization: Bearer $CUST_TOKEN" | jq -r '.data[0].id')

# Try placing order with 1 unit (should be below ₹199)
curl -s -X POST "http://localhost:7001/api/v1/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" -H "Content-Type: application/json" \
  -d "{\"storeId\": \"$STORE_ID\", \"fulfillmentType\": \"PICKUP\", \"paymentMethod\": \"COD\", \"useWallet\": false, \"items\": [{\"storeProductId\": \"$SP_ID\", \"quantity\": 1}]}" \
  | jq '{success: .success, error: .error, message: .message}'
# Expected: { "success": false, "error": "Minimum Order Not Met", "message": "Minimum order amount is ₹199..." }
```

### 4. API — Base delivery fee + free delivery override

```bash
# Place a delivery order with total between ₹199–498 → deliveryFee should be ₹30 (base fee)
# Place a delivery order with total ≥ ₹499 → deliveryFee should be ₹0 (free delivery)
# Verify via: jq '.data.deliveryFee' on the order response
```

### 5. Admin — Store create form

- [x] Go to http://localhost:7000/stores/create
- [x] "Order & Delivery" card should appear below "Delivery Location"
- [x] Fields: Min Order Amount, Base Delivery Fee, Free Delivery Threshold — all with ₹ prefix
- [x] Enter values, create store — values should persist

### 6. Admin — Store edit form

- [x] Go to http://localhost:7000/stores/edit/375d5737-069b-42f0-9791-1cc8390c0993
- [x] "Order & Delivery" card should show current values (199, 30, 499)
- [x] Change values, save — should update successfully
- [x] Clear all fields, save — should set to null (no restrictions)

### 7. Mobile — Cart below minimum (< ₹199)

- [x] Login as customer, select Bigmart store
- [x] Add a single cheap item (total < ₹199)
- [x] Go to Cart tab
- [x] **Orange nudge**: "Add ₹X more to place your order (min ₹199)"
- [x] No free delivery nudge visible
- [x] Bill details: delivery fee shows "₹30"
- [x] Checkout button **grayed out** with "Min ₹199" and lock icon
- [x] Tapping checkout does nothing

### 8. Mobile — Cart between minimum and free delivery (₹199–498)

- [x] Add more items so total is between ₹199 and ₹498
- [x] Orange nudge disappears
- [x] **Teal nudge**: "Add ₹X more for free delivery"
- [x] Bill details: delivery fee shows "₹30"
- [x] Checkout button **enabled** (teal, "Checkout" text)
- [x] Tap Checkout → checkout screen
- [x] Checkout: delivery fee row shows "₹30" (not FREE)
- [x] No warning banner at top
- [x] Place order button enabled

### 9. Mobile — Cart above free delivery (≥ ₹499)

- [x] Add more items so total is ₹499 or above
- [x] No nudge banners in cart
- [x] Bill details: delivery fee shows "FREE"
- [x] Go to checkout
- [x] Delivery fee row: strikethrough "₹30" + **"FREE"**
- [x] Grand total reflects ₹0 delivery fee

### 10. Mobile — Checkout min order guard

- [x] With cart below ₹199, navigate to checkout
- [x] Orange warning banner at top
- [x] Place order button disabled

### 11. Edge cases

- [ ] Store with no fields set (all null): no nudges, no restrictions, delivery fee from zones/tiers as normal
- [ ] Store with only `minOrderAmount`: min order enforced, no delivery fee changes
- [ ] Store with only `baseDeliveryFee`: flat fee always charged, no free delivery
- [ ] Store with only `freeDeliveryThreshold` (no base fee): free delivery nudge shows but delivery might be ₹0 anyway if no tiers/zones
- [ ] Store with `baseDeliveryFee` + `freeDeliveryThreshold`: fee charged below threshold, waived above
- [ ] Pickup orders: delivery fee is always 0, free delivery nudge should NOT appear
- [ ] Distance tier overrides base fee: if a tier matches with ₹50, that's used instead of base ₹30
- [ ] Coupon discount does NOT affect threshold checks (thresholds use `itemsTotal`, not post-coupon total)

## Files Changed

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | 3 `Decimal?` fields on `Store` |
| `packages/shared/src/schemas/index.ts` | `createStoreSchema` + `updateStoreSchema` |
| `apps/api/src/routes/orders/index.ts` | Min order validation + base fee fallback + free delivery override |
| `apps/admin/src/pages/stores/create.tsx` | Order & Delivery card |
| `apps/admin/src/pages/stores/edit.tsx` | Order & Delivery card |
| `apps/mobile/lib/types.ts` | Store interface |
| `apps/mobile/app/(tabs)/cart.tsx` | Nudge banners + delivery fee display + disabled checkout |
| `apps/mobile/app/checkout.tsx` | Warning banner + fee resolution with base fallback + free delivery display |
