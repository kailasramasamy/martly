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

| # | Feature | What It Is | Effort |
|---|---------|-----------|--------|
| 1 | **Live order tracking (map)** | Real-time rider GPS on a map during delivery. Every single app has this. | Medium — needs rider location broadcasting + map UI on mobile |
| 2 | **Return/refund requests** | In-app claim with photo upload, reason selection. Currently refunds are admin-only wallet credits. | Medium — new model + API + mobile screen |
| 3 | **Minimum order amount** | Block checkout below a threshold (per store). Blinkit/Zepto/all enforce this. | Small — store config field + checkout validation |
| 4 | **Delivery instructions** | Free-text field at checkout ("leave at door", "call before"). Standard everywhere. | Small — field on order + checkout UI |
| 5 | **Saved/default payment method** | One-tap reorder with saved UPI/card. Reduces checkout friction. | Small-Medium — Razorpay tokenization |

## Tier 2: Emerging Standards (most competitors have, strong user expectation)

| # | Feature | What It Is | Effort |
|---|---------|-----------|--------|
| 6 | **Frequently bought together** | "Customers also bought" suggestions on product detail + cart. Drives AOV. BigBasket, Blinkit, Instacart all have it. | Medium — co-purchase analysis + UI |
| 7 | **Subscription / auto-delivery** | Recurring delivery of daily essentials (milk, bread, eggs). BigBasket's SmartBasket is the gold standard. | Large — new model, scheduler, management UI |
| 8 | **Membership plan** | Paid tier with free delivery + member-only prices. Swiggy One, Instacart+, BB Star. | Medium — membership model, checkout integration, admin config |
| 9 | **Cart upsells / nudges** | "Add Rs 50 more for free delivery", "Complete your basket" prompts at checkout. Universal. | Small — checkout logic + UI |
| 10 | **WhatsApp order updates** | Order confirmations + status via WhatsApp. Massive open rates in India vs push. | Small-Medium — WhatsApp Business API integration |

## Tier 3: Differentiators (fewer competitors have, high impact)

| # | Feature | What It Is | Effort |
|---|---------|-----------|--------|
| 11 | **Shoppable recipes** | Browse recipes, one-tap "Add all ingredients to cart". Instacart's killer feature. | Medium — recipe model + ingredient-to-product mapping |
| 12 | **Substitution preferences** | Per-item rules: "replace with X" or "refund if unavailable". Critical for stock-out handling. | Medium — preference storage + fulfillment integration |
| 13 | **Context-aware recommendations** | Time-of-day suggestions (breakfast items in AM, snacks in evening). Weather-based (hot drinks when cold). | Medium — time/context logic + personalized home feed |
| 14 | **Gamification** | Scratch cards on order completion, streak rewards, achievement badges. Blinkit uses this for engagement. | Medium — reward events + UI |
| 15 | **Prepared food / cafe menu** | Ready-to-eat meals section. Blinkit Bistro and Zepto Cafe are the hottest battleground in Indian q-commerce right now. | Large — separate catalog type, kitchen ops |

## Tier 4: Nice-to-Have (lower priority, future consideration)

| # | Feature | What It Is |
|---|---------|-----------|
| 16 | **Group/family cart** | Collaborative shopping list shared with household members |
| 17 | **Barcode scanner** | Scan physical product -> add to cart |
| 18 | **Gift cards** | Purchasable store credits to gift others |
| 19 | **Price drop alerts** | Notify when a wishlisted item goes on sale |
| 20 | **Multi-language support** | Hindi + regional language UI (BigBasket supports 7 languages) |

---

## Recommended Build Order

Next 5 features to close the biggest gaps:

1. **Minimum order amount + cart nudges** — Tiny effort, directly impacts profitability
2. **Delivery instructions** — Tiny effort, table-stakes UX gap
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
