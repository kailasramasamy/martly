# Banner Guide

## Placement Types & Image Dimensions

| Placement | Dimensions (@2x) | Where it appears | Suggested Count |
|-----------|------------------|------------------|-----------------|
| HERO_CAROUSEL | 750 × 360 | Home screen — top, auto-rotating full-width carousel | 3–4 |
| CATEGORY_STRIP | 280 × 180 | Home screen — horizontal scrollable row below hero | 5 |
| MID_PAGE | 750 × 240 | Home screen — between sections (e.g., after deals, before recipes) | 2–3 |
| POPUP | 680 × 400 | Home screen — modal overlay on first visit / app open | 1–2 |
| CATEGORY_TOP | 750 × 200 | Category detail screen — full-width banner above product grid | 2–3 |

---

## HERO_CAROUSEL

**Displayed on:** Home screen — top of page, auto-rotating full-width carousel with dot indicators.

Full-width auto-rotating carousel at top of home screen. Bold product photography, large text, vibrant backgrounds.

| # | Title | Subtitle | Action Type | Action Target |
|---|-------|----------|-------------|---------------|
| 1 | Fresh Morning Deals | Up to 25% off on dairy & eggs | CATEGORY | Morning Essentials subcategories (milk, eggs, curd) |
| 2 | Weekend Snack Fest | Chips, biscuits & more from ₹20 | CATEGORY | Snacks & Beverages department |
| 3 | Farm Fresh Vegetables | Delivered within hours | CATEGORY | Fruits & Vegetables department |
| 4 | New Arrivals: Premium Coffee | Explore our coffee collection | COLLECTION | best-sellers collection |

---

## CATEGORY_STRIP

**Displayed on:** Home screen — horizontal scrollable row below the hero carousel, above time-based categories.

Horizontal scrolling cards (140×90px each). Simple icon/product image with solid color background — category shortcut tiles.

| # | Title | Subtitle | Action Type | Action Target |
|---|-------|----------|-------------|---------------|
| 1 | Dairy | Fresh daily | CATEGORY | Dairy & Eggs dept |
| 2 | Atta & Rice | Staples | CATEGORY | Foodgrains dept |
| 3 | Snacks | Munch time | CATEGORY | Snacks dept |
| 4 | Baby Care | Essentials | CATEGORY | Baby Care dept |
| 5 | Cleaning | Home needs | CATEGORY | Cleaning dept |

---

## MID_PAGE

**Displayed on:** Home screen — inserted between content sections (e.g., after deals row, before recipes).

Full-width banner mid-scroll (120px height). Horizontal layout with product collage on one side, text + CTA on the other.

| # | Title | Subtitle | Action Type | Action Target |
|---|-------|----------|-------------|---------------|
| 1 | Buy 2 Get 10% Off | On all instant noodles | CATEGORY | Instant Noodles subcategory |
| 2 | Summer Coolers | Juices, lassi & ice cream | CATEGORY | Beverages department |
| 3 | Cook Tonight | Everything for dinner, one tap | COLLECTION | evening time-category concept |

---

## POPUP

**Displayed on:** Home screen — modal overlay triggered on app open or first visit. Dismissible with X button.

Modal overlay (340×200px image area). Eye-catching, single focused message. Use sparingly — one active popup max.

| # | Title | Subtitle | Action Type | Action Target |
|---|-------|----------|-------------|---------------|
| 1 | First Order? Get ₹50 Off | Use code WELCOME50 | URL | coupon deep link |
| 2 | Free Delivery This Weekend | On orders above ₹299 | NONE | — |

---

## CATEGORY_TOP

**Displayed on:** Category detail screen — full-width banner at the top, above the product grid. Shown when browsing a specific department/category.

Top of category detail pages (full-width, compact). Contextual to the category being browsed — subtle, informative.

| # | Title | Subtitle | Action Type | Target Dept/Cat |
|---|-------|----------|-------------|-----------------|
| 1 | Fresh from the farm | Organic veggies now available | NONE | Place on: Fruits & Vegetables dept |
| 2 | Baby Week Sale | Up to 20% off all baby products | NONE | Place on: Baby Care dept |
| 3 | Breakfast Combos | Milk + bread + eggs | COLLECTION | Place on: Dairy & Eggs dept |

---

## Action Types

| Action Type | Behavior | actionTarget value |
|-------------|----------|-------------------|
| NONE | No tap action | — |
| CATEGORY | Navigate to department/category/subcategory | ID of the dept/cat/subcat |
| PRODUCT | Navigate to product detail | Product ID |
| URL | Open external URL | Full URL |
| COLLECTION | Navigate to collection | Collection slug |

## Targeting

Banners can be scoped to:
- **Store-specific**: Set `storeId` — only shows in that store
- **Org-wide**: Set `organizationId` only — shows in all org stores
- **Global**: No store or org — shows everywhere

## Scheduling

- `startsAt` / `endsAt` — optional date range
- `isActive` — manual toggle
- `sortOrder` — display order within placement group
