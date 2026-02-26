# Loyalty Points / Rewards System

## Overview

Org-scoped loyalty points system where customers earn points on delivered orders and redeem them as discounts at checkout. Points are earned and redeemable at any store within the same organization.

## How It Works

### Earning
- Points are credited when an order reaches **DELIVERED** status
- Formula: `points = floor(orderTotal / 100 * earnRate)`
- Default earn rate: 1 point per ₹100 spent

### Redemption
- **1 point = ₹1** discount at checkout
- Minimum points required to redeem (configurable, default: 10)
- Maximum redemption capped at `maxRedeemPercentage` of order total (default: 50%)
- Checkout deduction order: **Coupon → Delivery fee → Wallet → Loyalty → Payment gateway**

### Reversals
- If an order is cancelled, redeemed points are credited back
- If a delivered order is later cancelled, earned points are deducted

## Database Schema

| Table | Purpose |
|-------|---------|
| `loyalty_configs` | Per-org settings (earn rate, min redeem, max %) |
| `loyalty_balances` | Per-user-per-org point balance |
| `loyalty_transactions` | Audit trail (EARN, REDEEM, REVERSAL, ADJUSTMENT) |
| `orders.loyalty_points_used` | Points redeemed on this order |
| `orders.loyalty_points_earned` | Points earned from this order |

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/loyalty?storeId=X` | Customer | Balance, config, transaction history |
| GET | `/api/v1/loyalty/config` | Admin | Get org's loyalty config |
| PUT | `/api/v1/loyalty/config` | Admin | Create/update loyalty config |
| GET | `/api/v1/loyalty/customers` | Admin | Paginated customer loyalty list |
| GET | `/api/v1/loyalty/customers/:userId` | Admin | Customer detail + transactions |
| POST | `/api/v1/loyalty/adjust` | Admin | Manual point adjustment |

## Admin Panel

- **Marketing → Loyalty Settings**: Configure earn rate, min redemption, max %, enable/disable
- **Marketing → Loyalty Points**: View all customer balances, search, adjust points manually
- **Orders → Show**: Displays loyalty points used and earned on each order

## Mobile App

- **Profile → Loyalty Points**: Balance card, stats, transaction history
- **Checkout**: Toggle to use loyalty points (after wallet), shows deduction in bill, earn preview
- **Order Detail**: Shows points used/earned

## Seed Data

Run `npx tsx prisma/seed-loyalty.ts` from `apps/api/` to seed:
- Loyalty config for Innovative Foods (earn rate: 1, min redeem: 10, max: 50%)
- 150 points for customer@martly.dev
- 3 sample transactions

## Testing

### Verify balance
```bash
curl -s "http://localhost:7001/api/v1/loyalty?storeId=<BIGMART_ID>" \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```

### Place order with loyalty
Send `useLoyaltyPoints: true` in the create order payload.

### Verify earn on delivery
Mark an order as DELIVERED and check that `loyaltyPointsEarned` is set and balance increased.

### Verify reversal on cancel
Cancel an order and check that used/earned points are reversed.

### Admin config
```bash
curl -X PUT "http://localhost:7001/api/v1/loyalty/config" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":true,"earnRate":2,"minRedeemPoints":10,"maxRedeemPercentage":50}'
```

## What Needs Manual Verification

1. Admin panel: Navigate to Marketing → Loyalty Settings, save config
2. Admin panel: Navigate to Marketing → Loyalty Points, verify customer list and adjust modal
3. Admin panel: Open an order with loyalty points, verify display
4. Mobile: Profile → Loyalty Points screen
5. Mobile: Checkout with loyalty toggle enabled
6. Mobile: Order detail showing points used/earned
