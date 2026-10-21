# Brand Promotion

Brands get ahead in a store in two ways:

- **Store-promoted** (free, phase 1): the organisation's own brands and the brands the owner features. They rank ahead, but stay inside the normal results, and carry an "Our brand" or "Featured" badge.
- **Paid** (phases 2–3): brand campaigns bought through the brand portal. They get fixed slots marked "Ad" (`SPONSORED_PRODUCT` today; search, suggestions and the bottom-nav slot next).

The two never compete for the same position: paid products take fixed slots, and store-promoted brands are boosted inside the ranking.

## Rules

1. **Relevance first.** A boost only reorders products that already match. A featured masala brand never shows up for "milk".
2. **No flooding.** Search gives a boosted brand weighted turns. Category listings give boosted brands every third slot.
3. **Always labelled.** Boosted products carry a badge on the card, and paid ones say "Ad".
4. **The shopper's choice wins.** A brand they named, or one they've bought before, beats any boost in voice, list and photo orders. A boosted brand is only ever the first option to pick from, never added for them.

## Phase 1: store-promoted brands (built 2026-10-21)

### Data

- `Organization.boostOwnBrands` (default `true`): brands with `Brand.organizationId` = the org are "Our brand".
- `OrgBrandFeature (organizationId, brandId)`: brands the owner features (distributor deals, local favourites), up to 50. A brand can't be both featured and blocked.
- `storeBrandBoost(prisma, storeId)` (`apps/api/src/services/brand-boost.ts`) returns `Map<brandId, "OWN" | "FEATURED">`. Own wins if a brand is both.

### Where it applies

| Surface | Effect |
|---|---|
| Search (`searchProducts`) | Boosted brands rank with popularity 105 in the weighted brand turns (a 100-popularity leader gets 100), so they take the first turn and every 15 points after. Relevance bands (intent, name tier, taxonomy) are unchanged |
| Category listings (`GET /stores/:id/products?categoryId=`) | With no sort and no brand filter, boosted rows take slots 1, 4, 7… until they run out (`boostedListingPage`; the slot math pages in the DB). Sorting by price turns the boost off, but the badge stays |
| Voice / list / photo to cart | Search order includes the boost, so an unbranded line ("chilli powder") lists the featured brand first among its options (`PICK`), never `MATCHED`. The boost is loaded once per run |
| Cards | `brandPick: "OWN" | "FEATURED"` on store-product rows; `BrandPickBadge` in `CompactProductCard` / `FeaturedProductCard` ("Our brand" / "Featured", Tamil included). An Ad badge replaces it on a sponsored row |

### Owner controls

`GET/PUT /api/v1/marketing/brand-ads` now also carries `boostOwnBrands` and `featuredBrandIds` / `featuredBrands`.
- Admin: Marketing → Brand ads → **Brands you promote** card.
- Mobile Manage: Brand ads screen → **Brands you promote** card. One Save button covers both cards.

## Tested (curl, Harur Fresh Mart, Demo Grocers featuring Sakthi Masala)

- `chilli powder`: Sakthi went from 11th to 1st. Its other products show at 3, 10 and 15 for "masala", not as one block.
- `turmeric`: the fresh turmeric intent band still leads, and Sakthi Turmeric Powder is 3rd. `milk` didn't change.
- Spices category, 1,580 rows: `S..S..S..` pattern. Paging through every page returns each row exactly once, and Sakthi's 67 rows sit within the first 200. A `price_asc` sort isn't boosted.
- List to cart "chilli powder / turmeric powder / MDH garam masala": the first two are `PICK` with Sakthi first and flagged. MDH is `MATCHED`.
- Own brand (Test Mills, "multigrain atta"): 14th with `boostOwnBrands` off, 2nd with it on, with the label removed when off.
- `PUT` with the same brand both featured and blocked gives a 400.

Seed: `cd apps/api && npx tsx prisma/seed-brand-boost.ts` (features Sakthi Masala for the first org).

## Needs manual check

- The badge on cards in search, the category screen and the list-to-cart picker (English and Tamil).
- The Manage → Brand ads screen: add and remove featured brands, the switch, and Save.
- The admin Brand ads tab: the new card saves on change.

## Next phases (decided 2026-10-21)

- **Phase 2:** sponsored products in search results (slots 1 and 6) and a sponsored row in suggestions, both from the existing `SPONSORED_PRODUCT` booking. In the cart picker, a sponsored product comes after the brand the customer named and after what they bought before. `ad_events` per surface. No sponsored slot when the query names a brand.
- **Phase 3:** `BRAND_TAB_SLOT` for the bottom nav: one brand per week across all stores. If unsold, it falls back to the org's own brand, then the daily rotation.
- Stores get no revenue share of brand ads.
