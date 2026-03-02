# Martly Feature Gap Analysis

Audit date: 2026-03-02
Compared against: Blinkit, Zepto, BigBasket, Swiggy Instamart, Instacart

---

## Current State Summary

Martly has 38 API routes, 50+ admin pages, and 25+ mobile screens covering:

- **Auth**: Email/password, OTP login, multi-tenant roles, token refresh
- **Catalog**: Two-tier products (master + org), variants, hierarchical categories, brands
- **Store Ops**: Multi-store, per-store pricing/stock/discounts, featured products
- **Orders**: Delivery/pickup/express/scheduled, status workflow, stock reservation
- **Payments**: Razorpay online, COD, wallet (auto-deduct), split payment
- **Loyalty**: Org-scoped points, earn/redeem, admin config
- **Coupons**: Flat/percentage, usage limits, date ranges
- **Delivery**: Zones (pincode), distance tiers, time slots, express config, rider/trip mgmt
- **Marketing**: Banners, collections, reviews, store ratings, notifications, campaigns, templates
- **Engagement**: Referrals, wishlist, smart reorder nudges
- **AI**: Shopping assistant, support chatbot, store intelligence, customer insights, product description generator, intelligent search
- **Admin**: Dashboard with KPIs/charts, stock management, delivery board

---

## Tier 1: Table-Stakes (every competitor has these)

- [x] **Minimum order amount** — Block checkout below a threshold (per store). Blinkit/Zepto/all enforce this. `Small` *(done: min order + base delivery fee + free delivery threshold)*
- [x] **Delivery instructions** — Free-text field at checkout ("leave at door", "call before"). Standard everywhere. `Small` *(already built: deliveryNotes field on Order, TextInput on checkout, shown in admin order detail)*
- [x] **Return/refund requests** — In-app claim with photo upload, reason selection. Currently refunds are admin-only wallet credits. `Medium`
- [ ] **Live order tracking (map)** — Real-time rider GPS on a map during delivery. Every single app has this. `Medium`
- [ ] **Saved/default payment method** — One-tap reorder with saved UPI/card. Reduces checkout friction. `Small-Medium`

## Tier 2: Emerging Standards (most competitors have, strong user expectation)

- [x] **Cart upsells / nudges** — "Add ₹X more for free delivery", "Complete your basket" prompts at checkout. Universal. `Small` *(done: free delivery nudge + min order nudge)*
- [ ] **Frequently bought together** — "Customers also bought" suggestions on product detail + cart. Drives AOV. `Medium`
- [ ] **WhatsApp order updates** — Order confirmations + status via WhatsApp. Massive open rates in India vs push. `Small-Medium`
- [ ] **Membership plan** — Paid tier with free delivery + member-only prices. Swiggy One, Instacart+, BB Star. `Medium`
- [ ] **Subscription / auto-delivery** — Recurring delivery of daily essentials (milk, bread, eggs). BigBasket's SmartBasket. `Large`

## Tier 3: Differentiators (fewer competitors have, high impact)

- [ ] **Shoppable recipes** — Browse recipes, one-tap "Add all ingredients to cart". Instacart's killer feature. `Medium`
- [ ] **Substitution preferences** — Per-item rules: "replace with X" or "refund if unavailable". Critical for stock-out handling. `Medium`
- [ ] **Context-aware recommendations** — Time-of-day suggestions (breakfast in AM, snacks in evening). Weather-based. `Medium`
- [ ] **Gamification** — Scratch cards on order completion, streak rewards, achievement badges. `Medium`
- [ ] **Prepared food / cafe menu** — Ready-to-eat meals section. Blinkit Bistro and Zepto Cafe. `Large`

## Tier 4: Nice-to-Have (lower priority, future consideration)

- [ ] **Group/family cart** — Collaborative shopping list shared with household members
- [ ] **Barcode scanner** — Scan physical product -> add to cart
- [ ] **Gift cards** — Purchasable store credits to gift others
- [ ] **Price drop alerts** — Notify when a wishlisted item goes on sale
- [ ] **Multi-language support** — Hindi + regional language UI (BigBasket supports 7 languages)

---

## Recommended Build Order

Next features to close the biggest gaps:

1. ~~**Minimum order amount + cart nudges**~~ — Done
2. ~~**Delivery instructions**~~ — Done
3. **Frequently bought together** — Medium effort, proven AOV driver
4. **Return/refund requests** — Medium effort, currently a missing customer-facing flow
5. **Live order tracking** — Medium effort, the single most expected feature in delivery apps

---

## Sources

Compared against feature sets of:
- Blinkit (46% market share in Indian q-commerce)
- Zepto (10-min delivery, 45K+ SKUs)
- BigBasket (India's largest online grocery, SmartBasket subscriptions)
- Swiggy Instamart (cross-platform One membership, Maxxsaver)
- Instacart (US market leader, agentic AI, shoppable recipes, Caper Carts)
- Getir/Gorillas (European q-commerce)
