# Saved Payment Methods & Payment Preferences

## Overview

Razorpay-managed saved cards/UPI — when a customer pays online, Razorpay creates a customer record and remembers their payment instruments. On subsequent checkouts, Razorpay's UI shows saved cards (CVV-only re-auth) and remembered UPI VPAs automatically.

Additionally, the customer's last-used payment method (ONLINE/COD) is remembered and pre-selected on their next checkout.

## How It Works

### Razorpay Customer Lifecycle

1. **First online payment**: `ensureRazorpayCustomer()` creates a Razorpay customer via API, stores `razorpay_customer_id` on the user
2. **Subsequent payments**: the stored `customer_id` is passed to Razorpay order creation + checkout SDK
3. **Razorpay checkout UI**: automatically shows saved cards and UPI VPAs when `customer_id` is present
4. No custom "manage saved cards" screen needed — Razorpay handles this in their checkout flow

### Payment Preference Flow

1. On checkout mount, `GET /api/v1/orders/payment-preferences` is called
2. If `preferredPaymentMethod` is set (ONLINE or COD), the payment method selector is pre-selected
3. After successful online payment verification, preference is saved as "ONLINE" server-side
4. After COD order, preference is saved as "COD" client-side

## Schema Changes

Three fields added to `User` model:

| Field | Type | Purpose |
|-------|------|---------|
| `razorpayCustomerId` | `String?` (unique) | Razorpay customer ID for saved instruments |
| `preferredPaymentMethod` | `String?` | Last used method: "ONLINE" or "COD" |
| `lastUpiVpa` | `String?` | Last used UPI VPA for prefilling |

## API Endpoints

### `GET /api/v1/orders/payment-preferences`

Returns the customer's payment preferences.

**Auth**: Required (JWT)

**Response**:
```json
{
  "success": true,
  "data": {
    "preferredPaymentMethod": "ONLINE",
    "lastUpiVpa": "user@upi",
    "hasRazorpayCustomer": true
  }
}
```

### `PATCH /api/v1/orders/payment-preferences`

Updates the customer's payment preferences.

**Auth**: Required (JWT)

**Body**:
```json
{
  "preferredPaymentMethod": "COD",
  "lastUpiVpa": "user@upi"
}
```

### `POST /api/v1/orders/:id/payment` (modified)

Now also returns `customer_id` in the response when available:
```json
{
  "success": true,
  "data": {
    "razorpay_order_id": "order_xxx",
    "amount": 15000,
    "currency": "INR",
    "key_id": "rzp_xxx",
    "customer_id": "cust_xxx"
  }
}
```

## Files Changed

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | 3 fields on User model |
| `apps/api/src/services/payment.ts` | `ensureRazorpayCustomer()` helper, `customer_id` param on `createRazorpayOrder()` |
| `apps/api/src/routes/orders/index.ts` | Pass `customer_id` in payment flow, save preference on verify, new GET/PATCH endpoints |
| `apps/mobile/components/RazorpayCheckout.tsx` | Accept + pass `customerId` to native SDK and WebView |
| `apps/mobile/app/checkout.tsx` | Fetch + pre-select payment preference, pass `customer_id`, save COD preference |

## Verification

```bash
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@martly.dev","password":"customer123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

# Check preferences (empty initially)
curl -s http://localhost:7001/api/v1/orders/payment-preferences \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Set preference to COD
curl -s -X PATCH http://localhost:7001/api/v1/orders/payment-preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preferredPaymentMethod":"COD"}' | python3 -m json.tool

# Verify saved
curl -s http://localhost:7001/api/v1/orders/payment-preferences \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Mobile: checkout screen auto-selects last-used payment method. Online payments pass `customer_id` to Razorpay, enabling saved cards on subsequent checkouts.
