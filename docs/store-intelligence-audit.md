# Store Intelligence Module — Audit Report

**Date:** 2026-03-05
**Purpose:** Evaluate current analytics and intelligence features for standalone packaging.

---

## Current Feature Inventory

### 1. Core Dashboard

| | |
|---|---|
| **Endpoint** | `GET /api/v1/dashboard/stats?days=7\|30\|90` |
| **Admin Page** | `/dashboard` |
| **Access** | SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER |
| **Scope** | Org-level (STORE_MANAGER scoped to assigned stores) |

**Capabilities:**
- KPI cards: Total Revenue, Orders, AOV, Unique Customers — all with prior-period comparison (% delta)
- Revenue over time (area chart, daily granularity)
- Orders over time (bar chart, daily granularity)
- Orders by status breakdown (donut chart)
- Revenue by payment method — COD vs ONLINE (donut chart)
- Orders by fulfillment type — delivery vs pickup (donut chart)
- Top 10 products by quantity sold (DELIVERED orders only, revenue included)
- Recent 10 orders

**Limitations:**
- Top products merge all variants under one product name — no variant-level breakdown
- Recent orders are always all-time (ignores selected period)
- No per-store drill-down for ORG_ADMIN — only aggregate view
- Customer count includes cancelled orders
- Only 7/30/90 day buckets — no custom date range

---

### 2. Store Intelligence

| | |
|---|---|
| **Endpoints** | `GET /api/v1/store-intelligence/demand-forecast` |
| | `GET /api/v1/store-intelligence/reorder-suggestions` |
| | `GET /api/v1/store-intelligence/anomalies` |
| | `POST /api/v1/store-intelligence/generate-description` |
| **Admin Page** | `/store-intelligence` |
| **Access** | SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER |
| **Scope** | Single store (requires `storeId`) |

**Tab 1 — Demand Forecast:**
- Per-SKU demand metrics from DELIVERED orders
- Fields: current stock, avg daily demand, days of stock left, total qty sold, total orders, last order date
- Configurable lookback: 7, 14, 30, 90 days
- Sorted by urgency (lowest days-of-stock first)

**Tab 2 — Reorder Suggestions:**
- Filtered view: only SKUs where `daysOfStockLeft <= threshold`
- Urgency tiers: critical (<=2d), warning (<=5d), info (<=threshold)
- Suggested reorder qty = `ceil(avgDailyDemand * 14)` (2-week buffer)
- Configurable threshold: 3, 5, 7, 14 days

**Tab 3 — Anomaly Detection:**
- Demand spike: 7-day avg > 2x period baseline
- Demand drop: 7-day avg < 50% of period baseline
- Stock mismatch: negative stock or reservedStock > stock
- Dead stock: stock > 0, zero orders in period
- Severity scoring (high/medium/low) with expandable detail

**Tab 4 — AI Product Description Generator:**
- Accepts image URL or upload
- Claude Haiku returns: name, brand, description, suggested category, food type, estimated weight
- "Use for New Product" button pre-fills the product create form

**Limitations:**
- Only counts DELIVERED orders (excludes CONFIRMED — undercounts active demand)
- Reorder buffer hardcoded at 14 days — no per-product lead time config
- Anomaly detection uses simple ratio thresholds, no statistical smoothing or seasonality
- Dead stock flags items not sold in the lookback window, even if they were active before
- No cross-store rollup — ORG_ADMIN must check stores one at a time

---

### 3. Customer Insights (AI-Powered)

| | |
|---|---|
| **Endpoints** | `POST /api/v1/customer-insights/ask` |
| | `GET /api/v1/customer-insights/churn-risk` |
| | `GET /api/v1/customer-insights/review-summary` |
| **Admin Page** | `/customer-insights` |
| **Access** | SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER |
| **Scope** | Single store (requires `storeId`) |

**Tab 1 — Ask Your Store (AI Q&A):**
- Assembles 30-day store context: revenue, orders, customers, AOV, top 5 products, order status breakdown, payment methods, avg rating
- Compares to prior 30 days for trend direction
- Claude Haiku returns: headline, highlight cards, insights, and actionable tip
- Rate-limited: 30 requests/minute per user

**Tab 2 — Churn Risk:**
- All customers who ever ordered from the store
- Fields: order count, total spent, AOV, first/last order date, days since last order
- Risk tiers: active (<14d), at_risk (14-30d), churning (31-60d), churned (>60d)
- Suggested action text per tier
- Filterable by risk tier

**Tab 3 — AI Review Summary:**
- Reads up to 200 product reviews + 200 store ratings
- Claude Haiku returns: overall sentiment, summary, positives, negatives, patterns, recommendations
- Graceful fallback when no comments exist

**Limitations:**
- "Ask Your Store" context is locked to 30 days — no custom window
- Churn risk is all-time with no date filter — no way to see churn trends over time
- No export or bulk actions on churn list (e.g., send coupons to all churning customers)
- Review summary requires manual trigger — not pre-computed
- Suggested actions are static text, not connected to coupon/notification system

---

### 4. Review Analytics

| | |
|---|---|
| **Endpoint** | `GET /api/v1/review-analytics?days=7\|30\|90` |
| **Admin Page** | `/review-analytics` |
| **Access** | SUPER_ADMIN, ORG_ADMIN only |
| **Scope** | Org-level |

**Capabilities:**
- KPIs: total reviews (period), avg rating (all-time approved), pending moderation (all-time), response rate (period)
- Rating distribution (1-5 stars, all-time approved)
- Review volume over time (area chart)
- Top 10 and bottom 10 rated products (min 2 reviews)
- Store ratings summary: count, avg overall/delivery/packaging

**Limitations:**
- Rating distribution and store summary are all-time — don't respect the `days` filter
- STORE_MANAGER excluded (inconsistent with other modules)
- Response rate may double-count if multiple staff reply to one review
- No per-product drill-down from top/bottom tables

---

### 5. Stock Summary

| | |
|---|---|
| **Endpoint** | `GET /api/v1/stock/summary?storeId=&organizationId=` |
| **Admin Page** | `/stock` |
| **Access** | SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER |
| **Scope** | Org-level with optional store filter |

**Capabilities:**
- Global totals: total SKUs, in-stock, low-stock (<=5 units), out-of-stock
- Per-store breakdown with same metrics
- Recent 20 updated store products

**Limitations:**
- Low stock threshold hardcoded at 5 — no admin configuration
- "Recent changes" shows any updated record, not actual stock movements
- No historical stock trend
- No alerts or notifications for low stock

---

### 6. Notification Analytics

| | |
|---|---|
| **Endpoints** | `GET /api/v1/notifications/admin/stats?days=` |
| | `GET /api/v1/notifications/admin/campaigns` |
| **Admin Page** | `/notifications/dashboard` |
| **Access** | SUPER_ADMIN, ORG_ADMIN |
| **Scope** | Org-level |

**Capabilities:**
- KPIs: campaigns sent, notifications delivered, read rate (%), avg recipients per campaign
- Daily stats table
- By-type breakdown (ORDER_UPDATE, PROMOTIONAL, SYSTEM, etc.)
- Top 5 campaigns by recipient count with read rate
- Recent 5 campaigns

**Limitations:**
- Read rate computed on-the-fly per campaign (N+1 query pattern)
- No click-through or conversion tracking
- No audience segment effectiveness comparison

---

### 7. Referral Analytics

| | |
|---|---|
| **Endpoints** | `GET /api/v1/referrals/stats`, `GET /api/v1/referrals/list` |
| **Admin Page** | `/referrals` |
| **Access** | SUPER_ADMIN, ORG_ADMIN |
| **Scope** | Org-level |

**Capabilities:**
- Total/pending/completed referral counts
- Total rewards given (referrer + referee)
- Conversion rate
- Paginated list with search and status filter

**Limitations:**
- All metrics are all-time — no period filter
- No top referrers leaderboard
- Reward cost not shown as % of generated revenue

---

### 8. Subscription Analytics

| | |
|---|---|
| **Endpoint** | `GET /api/v1/subscriptions/admin/stats` |
| **Admin Page** | `/subscriptions` |
| **Access** | SUPER_ADMIN, ORG_ADMIN |
| **Scope** | Org-level |

**Capabilities:**
- Counts by status: active, paused, cancelled, total
- Revenue from subscription orders (last 30 days, DELIVERED)
- Order count from subscriptions (last 30 days)
- Top 10 most-subscribed products

**Limitations:**
- 30-day window hardcoded — no configurable period
- No subscription churn rate
- No lifecycle chart (new vs renewed vs cancelled over time)

---

### 9. Smart Reorder (Customer-Facing)

| | |
|---|---|
| **Endpoint** | `GET /api/v1/smart-reorder?storeId=` |
| **Admin Page** | — (mobile only) |
| **Access** | Authenticated customers |
| **Scope** | Per-customer, per-store |

**Capabilities:**
- Per-customer reorder predictions based on purchase history
- Status: overdue (predicted need >= 1.0), due_soon (>= 0.7), not_yet
- Enriched store product objects with prediction data and suggested quantity

---

### 10. Delivery Board (Operational)

| | |
|---|---|
| **Endpoints** | `/api/v1/delivery-trips/*`, `/api/v1/riders/*` |
| **Admin Page** | `/delivery-board` |
| **Access** | SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER |
| **Scope** | Org-level |

**Capabilities:**
- Real-time order management via WebSocket
- Per-rider: total trips, active trips, completed trips (all-time)

**Limitations:**
- Purely operational — no analytics
- No avg delivery time, on-time rate, or distance metrics
- No rider efficiency comparison

---

## Cross-Cutting Gaps

### Architecture

| Gap | Detail |
|-----|--------|
| **No pre-aggregation** | Every analytics query runs against raw tables at request time. At scale (>10K orders), dashboard and review analytics will degrade. No materialized views, no nightly rollup jobs, no `daily_store_stats` table. |
| **In-memory rate limiting** | AI endpoints use per-process rate limiters. Multi-instance deploys will not enforce limits globally. |
| **No scheduled analytics jobs** | The 3 existing schedulers (reorder nudge, notifications, subscriptions) are event-driven. None write pre-computed aggregates. |

### Missing Analytics

| Gap | Impact |
|-----|--------|
| **No cross-store comparison** | ORG_ADMIN must manually switch between stores. No side-by-side or ranking view. |
| **No delivery performance analytics** | Avg delivery time, on-time %, SLA adherence — completely absent. Table-stakes for grocery ops. |
| **No revenue by category** | Dashboard shows top products but no category-level revenue or volume breakdown. |
| **No cohort / retention analysis** | Cannot track: "Of customers who ordered in Jan, what % returned in Feb?" Core growth metric. |
| **No wallet & loyalty analytics** | Credits issued, redemption rates, outstanding liability — not surfaced anywhere. |
| **No order funnel** | No visibility into cart abandonment, checkout drop-off, or conversion rates. |

### UX & Usability

| Gap | Detail |
|-----|--------|
| **No CSV/Excel export** | Zero export functionality across all analytics pages. Non-negotiable for B2B. |
| **Hardcoded thresholds** | Low stock (5), churn windows (14/30/60d), reorder buffer (14d), anomaly ratios (2x/0.5x) — all hardcoded. No admin settings. |
| **Inconsistent period handling** | Review Analytics mixes all-time and period data. Subscription stats locked to 30d. Dashboard recent orders ignores period. |
| **No custom date ranges** | All modules use preset buckets (7/30/90d). No date picker for arbitrary ranges. |
| **Churn actions not connected** | Churn risk shows "Send a win-back coupon" but doesn't link to the coupon or notification system. |

---

## Recommendations for Standalone Packaging

### Priority 1 — Must Have

1. **CSV export on all analytics pages** — every table and chart should have a download button
2. **Cross-store comparison dashboard** — let ORG_ADMIN rank and compare stores on key metrics
3. **Configurable thresholds** — org-level settings for low stock, churn windows, reorder buffer, anomaly sensitivity
4. **Delivery performance analytics** — avg delivery time, on-time rate, per-rider efficiency

### Priority 2 — Differentiators

5. **Pre-aggregated daily summaries** — nightly job writing to `daily_store_stats` table for fast dashboard loads
6. **Cohort retention analysis** — monthly cohort grid showing repeat purchase rates
7. **Revenue by category breakdown** — in dashboard and as standalone report
8. **Wallet & loyalty analytics** — credits issued, redemption rate, outstanding liability

### Priority 3 — Nice to Have

9. **Custom date ranges** — replace preset buckets with a date picker
10. **Connected churn actions** — "Send coupon" button on churn list that creates a targeted campaign
11. **Order funnel / conversion tracking** — cart-to-order conversion, checkout abandonment
12. **Scheduled email reports** — weekly digest sent to ORG_ADMIN with key metrics
