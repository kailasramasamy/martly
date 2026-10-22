# Banner Guide

## Placement Types & Image Dimensions

Category strip, mid-page, cart upsell and popup banners were removed on 2026-10-22: nothing had created them since promotions replaced the banner editor. They'll be redesigned as placements Martly sells. Brand posters and sponsored products are covered in `docs/brand-promotion.md`.

| Placement | Dimensions (@2x) | Where it appears | Suggested Count |
|-----------|------------------|------------------|-----------------|
| HERO_CAROUSEL | 750 × 360 | Home screen — top, auto-rotating full-width carousel | 3–4 |
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
