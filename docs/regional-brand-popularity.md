# Regional brand popularity

Status: built 2026-10-30.

## Problem

`brands.popularity` is one national score. Boosting Tamil Nadu brands (2ccdfe2) lifts Aachi, Hatsun, Udhaiyam and the rest for a Karnataka or Kerala store too. Popularity should follow the store's location.

## Design

**Key by region, not raw state.** Stores already map state → region with `regionOf(store.state)` (`STATE_TO_REGION` in `packages/shared/src/constants/onboarding.ts`; Puducherry → TN). Festivals and `brands.regions` use the same codes, so popularity does too. A new state becomes "regional" by adding one line to that map.

**Table** `brand_region_popularity`:

| column | type |
|---|---|
| brand_id | FK → brands, cascade delete |
| region | text (a `FestivalRegion` code except ALL) |
| popularity | int 0–100 |
| PK | (brand_id, region) |

No row means the brand uses its national `brands.popularity`. Only brands that differ by region get rows, so the table stays small (tens of rows per region).

**One SQL helper** in `apps/api/src/services/brand-popularity.ts`:

- `storeRegion(prisma, storeId)` → region or null, from `store.state`
- `brandPopularitySql(region)` → `COALESCE((SELECT popularity FROM brand_region_popularity WHERE brand_id = b.id AND region = ${region}), b.popularity, 0)`, or plain `COALESCE(b.popularity, 0)` when region is null

Each service swaps `COALESCE(b.popularity, 0)` for the helper. Each service already has the store id, so it costs one cheap lookup per request.

**Seed data:** `apps/api/prisma/data/brand-popularity-regions.json`, shaped `{ "TN": { "aachi": 92, … }, "KA": { … } }`. It's applied by `seed-search-intents.ts` next to the national file: upsert the listed rows and delete the rows that are no longer listed for that region.

**Undo the national TN boost:** move today's 24 TN scores into `regions.TN`, then put the national scores back where they were before 2ccdfe2 (Aachi, Sakthi, Hatsun, etc. drop back down outside TN).

## Callers to switch

| Service | Use |
|---|---|
| search.ts (`popularity()`), search-suggest.ts | search ranking and suggestions |
| store-walk.ts, cart-review.ts, brand-spotlight.ts | aisle best sellers, cart add-ons, spotlight pool |
| stock-check/counts.ts, stock-check/listing.ts | sample images, brand order |
| price-review/listing.ts | brand order |
| web-shop/lists.ts | martlyshop.in brand tiles |
| onboarding catalog-candidates.ts + catalog-proposal.ts | starter catalog |
| catalog-agent/match.ts | brand-name tie break only, so it stays national |

**Onboarding:** a brand's score is its regional popularity when it has a row, else its national one, plus `regionalBoost()` (+50 home region, +20 listed region) as before. Dropping the boost for brands with a row (the first plan) would have ranked Aachi (92) below an unscored TN brand (60 + 50).

## Admin

- Brand edit (SUPER_ADMIN only): a "Regional popularity" card of region and score pairs. Re-running `seed-search-intents.ts` resets each listed region to the file.
- Phase 2, not in this change: derive scores from actual sales per region once there's enough order volume.

## Tested

- Local, prod data: search "masala" and "ghee" at Sree Ranga (TN) put Aachi, Hatsun and GRB up; with the store's state set to Karnataka they dropped behind MDH, Everest, Amul and Patanjali.
- Saving a brand's regional rows replaces them (Prisma nested deleteMany + create).

## Manual checks

- Seed TN and KA rows locally.
- Search "masala" at a TN store: Aachi and Sakthi lead.
- Same search at a store with state set to Karnataka: MDH and Everest lead.
- Check that store walk, brand spotlight and the web brand tiles follow the same order.
- Check that a store with no state uses the national scores.

## Size

- 1 migration, 1 new service file (~40 lines), about 10 one-line SQL swaps.
- Seed script: about 25 lines.
- Admin: one form section.
- No mobile changes, so no store build is needed.
