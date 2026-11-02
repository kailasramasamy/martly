# Category brand ranking

Status: built 2026-10-31 (local, uncommitted).

## Why

`brands.popularity` (national) and `brand_region_popularity` (per region) are one score per brand, applied in every
category. MDH ranks near the top of Dal because of its spices; Amul tops Atta. Martly needs to push brands up or down
**within a category**, per region, with an optional override for one subcategory.

## How a product's brand score is resolved (first match wins)

1. Subcategory ranking for the store's region
2. Subcategory ranking for All India (`ALL`)
3. Category ranking for the region
4. Category ranking for `ALL`
5. The brand's regional score (`brand_region_popularity`)
6. The brand's national score (`brands.popularity`)

The store's region comes from its state (`storeRegion` → `regionOf`). The store's own brand (106) and featured brand
campaigns (105) still rank above every score in search, and the walk's own-brand lead is unchanged.

A saved order is stored as scores spread evenly from 100 (top) down to 1. A brand added to the category later has no
row, so it uses its normal score and lands wherever that puts it. A subcategory ranking counts wherever that product
appears: a soya brand ranked first in Mixed Pulses also scores 100 on the whole Dal aisle.

## Data

- `brand_category_popularity (brand_id, category_id, region, popularity)`, PK on all but popularity
- `brand_subcategory_popularity (brand_id, subcategory_id, region, popularity)`
- `region` is a `FESTIVAL_REGIONS` code, including `ALL`. Cascades from brand and category/subcategory.
- Migration `20261031120000_brand_category_ranking` (hand-written; applied on deploy by `migrate deploy`).

## API (SUPER_ADMIN)

- `GET /api/v1/brand-ranking/:level/:id?region=TN` → brands with active products there, in effective order, each with
  `popularity` and `source` (`here` | `allIndia` | `category` | `region` | `national`). `level` = `category` | `subcategory`.
- `PUT /api/v1/brand-ranking/:level/:id` `{ region, brandIds }` → replaces that level + region's ranking with this order.
- `DELETE /api/v1/brand-ranking/:level/:id?region=TN` → drops it; brands fall back to the next score in line.

Code: `services/brand-ranking.ts`, `routes/brand-ranking/index.ts`. Resolution lives in `services/brand-popularity.ts`:
`brandPopularitySql(region, alias, subcategorySql)` for SQL, `brandPopularityLookup(...)` for lists sorted in code.

## Where it applies

| Surface | Where |
|---|---|
| Walk the store shelves + brand chips | `services/store-walk.ts` (`popularIn`, `stockedBrands`) |
| Search ranking, brand suggestions | `services/search.ts` `popularity()`, `services/search-suggest.ts` |
| Category listing (app) | `routes/stores/index.ts` → `services/listing-order.ts`; brand chips in `services/category-browse.ts` |
| martlyshop.in category pages + brand filter | `services/web-shop/category-filters.ts` |

**Behaviour change:** an unsorted category listing used to show newest first. It now shows the ranking (brand score
where each product sits, then newest). The store's loose staples still lead staples aisles, and the own/featured
brands still take every third slot. Price/discount/newest sorts are unchanged.

Not changed (brand-level lists or owner tools): cart review, stock check, price review, pack tiles, onboarding, brand
spotlight, web brand tiles.

## Editing

- **Admin:** Categories → edit a category or subcategory → "Brand ranking" card (SUPER_ADMIN). Pick a region, drag
  brands, Save order; Reset drops that region's order. `pages/categories/brand-ranking.tsx`.
- **Manage app:** a category's or subcategory's screen → podium icon in the header (SUPER_ADMIN) → region chips,
  ↑/↓ per brand, Save order / Reset. `components/manage/taxonomy/BrandRankingScreen.tsx`. Needs a store build.

## Tested (local, prod data, Sree Ranga = TN)

- Dal & Pulses ranked for TN (Fortune, Tata Sampann, Udhaiyam, Saffola, Aashirvaad … Nutrela, Hamdard, MDH last) and
  Mixed Pulses overridden for TN (Nutrela, MDH first).
  - Walk Dal: chips Ranga, Fortune, Nutrela, Tata Sampann…; shelves after the 6 Ranga packs led by Fortune. Mixed
    Pulses tile: Nutrela, MDH lead.
  - Category listing: ranked after the loose staples; pages 1–3 had no repeats; `price_asc` unchanged; chips ranked.
  - Search "dal": Fortune, Udhaiyam, Tata Sampann, Aashirvaad lead, own staples still take their turns.
  - Web Dal page: Fortune, Nutrela, Tata Sampann first; brand filter in the same order.
  - Store state switched to Karnataka: TN order ignored (MDH back on top); an `ALL` order applied there.
- PUT / GET / DELETE as SUPER_ADMIN; ORG_ADMIN → 403; unknown brand → 400; bad level → 400.
- Search latency unchanged (medians oil 1.11→1.08s, masala 0.83→0.69s, dal 0.61→0.60s).

## Manual checks

- Admin card: drag, save, reload keeps the order; Reset returns to the fallback; region switch.
- Manage screen on a device (SUPER_ADMIN): ↑/↓, save, reset.
- After deploy, rank a real category on prod and check the walk, category page and martlyshop.in.
