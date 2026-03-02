# Membership Plans (Mart Plus)

Paid membership tier giving customers free delivery, member-only prices, and bonus loyalty points — similar to Swiggy One, Instacart+, BB Star.

## Overview

### Customer Flow
1. Open Profile > tap "Mart Plus" quick link → Membership screen
2. View available plans (Monthly, Quarterly, Annual) with benefits
3. Tap "Subscribe" → Razorpay payment → Membership activated
4. Member benefits apply automatically: free delivery, member prices on products, loyalty multiplier

### Admin Flow
1. Marketing > Membership Plans → Create/edit plans (name, price, duration, freeDelivery, loyaltyMultiplier)
2. Marketing > Subscribers → View active members with plan details
3. Store Products > Edit → Set member price per product

### Order Benefits (Automatic)
- **Member pricing**: `min(memberPrice, effectivePrice)` applied per item
- **Free delivery**: Delivery fee = 0 when member plan has `freeDelivery: true`
- **Loyalty multiplier**: Points earned × `plan.loyaltyMultiplier` on order delivery

## Architecture

### Database Models

```
MembershipPlan (membership_plans)
├── id, organizationId, name, description
├── price (Decimal), duration (MONTHLY/QUARTERLY/ANNUAL)
├── freeDelivery (Boolean), loyaltyMultiplier (Float)
├── isActive, sortOrder, timestamps
└── Index: (organizationId, isActive)

UserMembership (user_memberships)
├── id, userId, planId, organizationId
├── status (ACTIVE/EXPIRED/CANCELLED)
├── startDate, endDate, pricePaid (Decimal)
├── razorpayOrderId, razorpayPaymentId, timestamps
└── Index: (userId, organizationId, status), (endDate)

StoreProduct.memberPrice (Decimal?) — per-product member price
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/memberships?storeId=X` | Customer | List plans + active membership |
| GET | `/memberships/status?storeId=X` | Customer | Lightweight member status check |
| POST | `/memberships/purchase` | Customer | Create Razorpay order for plan |
| POST | `/memberships/verify?planId=X` | Customer | Verify payment, activate membership |
| GET | `/memberships/plans` | Admin | List org plans (paginated) |
| POST | `/memberships/plans` | Admin | Create plan |
| PUT | `/memberships/plans/:id` | Admin | Update plan |
| DELETE | `/memberships/plans/:id` | Admin | Soft-delete (isActive=false) |
| GET | `/memberships/subscribers` | Admin | List active subscribers |

### Files

| Layer | File | Description |
|-------|------|-------------|
| Schema | `apps/api/prisma/schema.prisma` | MembershipPlan, UserMembership, StoreProduct.memberPrice |
| Shared | `packages/shared/src/constants/index.ts` | MembershipDuration, MembershipStatus enums |
| Shared | `packages/shared/src/schemas/index.ts` | Plan CRUD + purchase schemas |
| API | `apps/api/src/routes/memberships/index.ts` | 9 endpoints |
| API | `apps/api/src/services/pricing.ts` | memberPrice in PricingResult |
| API | `apps/api/src/routes/stores/index.ts` | Pass memberPrice to pricing |
| API | `apps/api/src/routes/orders/index.ts` | Member pricing, free delivery, loyalty multiplier |
| Admin | `apps/admin/src/pages/memberships/plans.tsx` | Plan management |
| Admin | `apps/admin/src/pages/memberships/subscribers.tsx` | Subscriber list |
| Admin | `apps/admin/src/pages/store-products/edit.tsx` | memberPrice field |
| Mobile | `apps/mobile/app/membership.tsx` | Membership screen |
| Mobile | `apps/mobile/components/FeaturedProductCard.tsx` | Member price badge |
| Mobile | `apps/mobile/components/ProductGridCard.tsx` | Member price badge |
| Mobile | `apps/mobile/app/checkout.tsx` | Free delivery + loyalty multiplier |
| Mobile | `apps/mobile/app/(tabs)/profile.tsx` | Mart Plus quick link |
| Seed | `apps/api/prisma/seed-memberships.ts` | Test data |

## Verification Checklist

### API
- [x] `GET /memberships?storeId=X` — returns plans + active membership
- [x] `GET /memberships/status?storeId=X` — returns `{ isMember: true, membership: {...} }`
- [x] `GET /memberships/plans` — admin returns paginated plans
- [x] Store products API returns `pricing.memberPrice` for products with member prices
- [ ] `POST /memberships/purchase` — creates Razorpay order
- [ ] `POST /memberships/verify` — activates membership after payment
- [ ] Order creation applies member pricing (min of memberPrice vs effectivePrice)
- [ ] Order creation waives delivery fee for members with freeDelivery plan
- [ ] Order delivery multiplies loyalty points by plan.loyaltyMultiplier

### Admin Panel
- [x] Marketing > Membership Plans — table loads with plans
- [x] Create/edit plan modal works
- [x] Toggle plan active/inactive
- [x] Marketing > Subscribers — table loads with member list
- [x] Store Products > Edit — memberPrice field saves correctly

### Mobile
- [x] Profile > Mart Plus quick link navigates to membership screen
- [x] Membership screen shows plans (no membership state)
- [x] Membership screen shows status card (active member state)
- [ ] Product cards show "₹X for members" for non-members
- [ ] Product cards show member price as primary for members
- [ ] Checkout shows "FREE" delivery with MEMBER badge for members
- [ ] Checkout shows loyalty multiplier in earn preview

## curl Commands

```bash
# Admin token
TOKEN=$(curl -s -X POST http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@martly.dev","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# List plans (admin)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:7001/api/v1/memberships/plans" | python3 -m json.tool

# List subscribers (admin)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:7001/api/v1/memberships/subscribers" | python3 -m json.tool

# Customer token
CTOKEN=$(curl -s -X POST http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@martly.dev","password":"customer123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

STORE=375d5737-069b-42f0-9791-1cc8390c0993

# View plans + active membership (customer)
curl -s -H "Authorization: Bearer $CTOKEN" \
  "http://localhost:7001/api/v1/memberships?storeId=$STORE" | python3 -m json.tool

# Check membership status (customer)
curl -s -H "Authorization: Bearer $CTOKEN" \
  "http://localhost:7001/api/v1/memberships/status?storeId=$STORE" | python3 -m json.tool

# Verify member pricing in store products
curl -s "http://localhost:7001/api/v1/stores/$STORE/products?pageSize=600" | \
  python3 -c "import sys,json; [print(f'{p[\"product\"][\"name\"]}: ₹{p[\"pricing\"][\"effectivePrice\"]} → ₹{p[\"pricing\"][\"memberPrice\"]}') for p in json.load(sys.stdin)['data'] if p['pricing'].get('memberPrice')]"
```

## Manual Verification

- Test Razorpay payment flow on mobile device (requires Razorpay test mode)
- Place an order as a member and verify: member prices applied, delivery fee waived, loyalty points multiplied
- Verify plan expiry: change endDate to past and confirm member benefits stop applying
