# Subscriptions / Auto-Delivery (Tomorrow's Basket)

## Overview

Recurring delivery subscriptions for daily essentials. Customers subscribe to products (milk, bread, dal) with a delivery frequency, and at a nightly cutoff the system auto-generates wallet-paid orders for next-morning delivery.

### Customer Flow
1. Browse products → tap "Subscribe" → choose frequency (daily / alternate / specific weekdays)
2. Pick delivery address → confirm
3. View/edit subscriptions: change items, quantities, frequency, skip/unskip days
4. Tomorrow's Basket: see what will be delivered tomorrow, add one-time extras
5. At cutoff (e.g., 10 PM), system auto-creates order from wallet

### Admin Flow
1. Enable subscriptions at org level, then per-store
2. Configure per-store: delivery mode (dedicated/slot-based), window times, cutoff time
3. View all subscriptions, filter by status/frequency/store
4. View subscription detail with order history and skip history
5. Dashboard stats: active/paused/cancelled counts, 30-day revenue, popular products

## Architecture

### Database Models

| Model | Purpose |
|-------|---------|
| `Subscription` | Core subscription: user, store, frequency, delivery address, status |
| `SubscriptionItem` | Products in a subscription with quantities |
| `SubscriptionSkip` | Dates the customer wants to skip delivery |
| `BasketAddOn` | One-time add-on items for a specific delivery date |

**Organization fields:** `subscriptionEnabled`
**Store fields:** `subscriptionEnabled`, `subscriptionDeliveryMode`, `subscriptionWindowStart/End`, `subscriptionCutoffTime`
**Order fields:** `subscriptionId`, `isSubscriptionOrder`, `scheduledDate`, `slotStartTime`, `slotEndTime`, `estimatedDeliveryAt`

### API Endpoints

#### Customer
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/subscriptions` | Create subscription |
| GET | `/api/v1/subscriptions` | List my subscriptions |
| GET | `/api/v1/subscriptions/:id` | Detail with calendar + pricing |
| PATCH | `/api/v1/subscriptions/:id` | Update frequency/items/status |
| DELETE | `/api/v1/subscriptions/:id` | Cancel subscription |
| POST | `/api/v1/subscriptions/:id/skip` | Skip a delivery date |
| DELETE | `/api/v1/subscriptions/:id/skip/:date` | Un-skip a date |

#### Basket
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subscriptions/basket?storeId=` | Tomorrow's basket |
| POST | `/api/v1/subscriptions/basket/items` | Add one-time item |
| PATCH | `/api/v1/subscriptions/basket/items/:spId` | Update add-on qty |
| DELETE | `/api/v1/subscriptions/basket/items/:spId` | Remove add-on |

#### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subscriptions/admin` | List all subscriptions |
| GET | `/api/v1/subscriptions/admin/:id` | Subscription detail |
| GET | `/api/v1/subscriptions/admin/stats` | Metrics |

#### Config
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subscriptions/config` | Get org + store config |
| PATCH | `/api/v1/subscriptions/config/org` | Toggle org subscriptions |
| PATCH | `/api/v1/subscriptions/config/store/:storeId` | Store config |

### Files

| File | Description |
|------|-------------|
| `apps/api/prisma/schema.prisma` | Subscription models + enums |
| `apps/api/src/routes/subscriptions/index.ts` | All API endpoints |
| `apps/api/src/plugins/subscription-scheduler.ts` | Auto-order scheduler |
| `packages/shared/src/constants/index.ts` | Subscription enums + labels |
| `packages/shared/src/schemas/index.ts` | Zod validation schemas |
| `apps/admin/src/pages/subscription-config/index.tsx` | Admin config page |
| `apps/admin/src/pages/subscriptions/list.tsx` | Admin subscription list |
| `apps/admin/src/pages/subscriptions/show.tsx` | Admin subscription detail |
| `apps/mobile/app/subscriptions.tsx` | My Subscriptions screen |
| `apps/mobile/app/subscription/[id].tsx` | Subscription detail + calendar |
| `apps/mobile/app/tomorrows-basket.tsx` | Tomorrow's Basket screen |
| `apps/mobile/app/subscription-builder.tsx` | Create Subscription flow |
| `apps/api/prisma/seed-subscriptions.ts` | Seed data |

## Delivery Window

Subscription orders use the store's fixed delivery window (`subscriptionWindowStart` / `subscriptionWindowEnd`, e.g. "07:00" / "09:00") for delivery time display.

### Scheduler
When the scheduler auto-creates orders, it sets:
- `fulfillmentType: "DELIVERY"`
- `scheduledDate`: tomorrow's date
- `slotStartTime` / `slotEndTime`: from store's subscription window config
- `estimatedDeliveryAt`: computed from `subscriptionWindowStart` + delivery date

This makes the "Scheduled Delivery" banner on the order detail screen work automatically (the banner shows when `scheduledDate && slotStartTime` are present).

### Basket API
The `/basket` endpoint returns `deliveryWindowStart` and `deliveryWindowEnd` from the store config. The Tomorrow's Basket screen displays this as **"Delivery on Tue, 3 Mar · 7:00 AM - 9:00 AM"**, falling back to date-only if the store has no window configured.

## Verification Checklist

### API
- [x] Create subscription with items
- [x] List subscriptions (filtered by store)
- [x] Get subscription detail with 7-day calendar and pricing
- [x] Update subscription (frequency, items, status)
- [x] Cancel subscription
- [x] Skip and unskip delivery dates
- [x] Get tomorrow's basket with subscription + add-on items
- [x] Add/update/remove basket add-on items
- [x] Admin list with pagination and filters
- [x] Admin stats (counts, revenue, popular products)
- [x] Config: get, update org toggle, update store config

### Admin Panel
- [x] Subscription Config page: org toggle + per-store config
- [x] Subscriptions list with filters
- [x] Subscription detail with items, orders, skips
- [x] Store create/edit forms include subscription config fields

### Mobile
- [x] My Subscriptions list with cards and frequency badges
- [x] Empty state with "Get Started" button
- [x] Tomorrow's Basket banner on home screen
- [x] Subscription detail with item editing
- [x] Calendar strip with skip/unskip
- [x] Pause/resume/cancel actions
- [x] Tomorrow's Basket with cutoff countdown
- [x] Subscription Builder: search, frequency, address, review
- [x] Profile quick link to My Subscriptions

## curl Commands

```bash
# Login as customer
CTOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@martly.dev","password":"customer123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

STORE="375d5737-069b-42f0-9791-1cc8390c0993"

# List subscriptions
curl -s -H "Authorization: Bearer $CTOKEN" \
  "http://localhost:7001/api/v1/subscriptions" | python3 -m json.tool

# Create subscription
curl -s -X POST -H "Authorization: Bearer $CTOKEN" -H "Content-Type: application/json" \
  -d '{"storeId":"'$STORE'","frequency":"DAILY","deliveryAddress":"123 Main St","items":[{"storeProductId":"<SP_ID>","quantity":2}]}' \
  "http://localhost:7001/api/v1/subscriptions" | python3 -m json.tool

# Get detail
curl -s -H "Authorization: Bearer $CTOKEN" \
  "http://localhost:7001/api/v1/subscriptions/<SUB_ID>" | python3 -m json.tool

# Tomorrow's basket
curl -s -H "Authorization: Bearer $CTOKEN" \
  "http://localhost:7001/api/v1/subscriptions/basket?storeId=$STORE" | python3 -m json.tool

# Skip a date
curl -s -X POST -H "Authorization: Bearer $CTOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-07"}' \
  "http://localhost:7001/api/v1/subscriptions/<SUB_ID>/skip" | python3 -m json.tool

# Admin login + stats
ATOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@martly.dev","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

curl -s -H "Authorization: Bearer $ATOKEN" \
  "http://localhost:7001/api/v1/subscriptions/admin/stats" | python3 -m json.tool
```
