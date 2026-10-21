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

## Phase 2: sponsored products in search, suggestions and list orders (built 2026-10-21)

The existing `SPONSORED_PRODUCT` booking (one product, brand portal, weekly) now also runs here. Ads come from `liveSponsored`, so the owner's brand-ads switch, blocked brands, the per-category slot cap, the in-stock check and the banner's view and tap counts all apply as before. Placement logic is in `apps/api/src/services/sponsored-search.ts`.

| Surface | Rule |
|---|---|
| Search results (`searchStoreProducts`) | Up to 2 ads, at product positions 1 and 6, one per brand, removed from their organic place. An ad's product must already rank in the top 40 for the query. No ads when sorted by price or discount, filtered by brand, or when the query names a brand (`namesBrand`) |
| Suggestions (`/search/suggest`) | One row right after the typed term: the ad product's name, marked Ad. Its name or aisle search terms must match the term (3+ characters), and the term mustn't name a brand. Tapping it searches that product name, which names the brand, so the results carry no ad |
| Voice / list / photo to cart | A line with no brand named moves a matching ad product to the front of its options, marked Ad. A brand the customer named or bought before still ranks above it, and it's never `MATCHED` (auto-added) |

- **Rotation:** with more eligible ads than slots, the order is a hash of query + IST day, so it's stable while scrolling and fair across days.
- **Paid vs store-promoted:** separate slots. Paid takes fixed positions and featured/own brands are boosted inside the organic ranking, so both show (an Everest ad at 1, featured Sakthi at 2).
- **Mobile:** product cards already showed Ad for `sponsored` rows and counted views and taps, so search results and the list picker get that for free. Suggestion rows show `AdBadge` and count a view on render and a tap on select.
- **Package copy:** migration `20261021160000_sponsored_product_in_search` rewords the `SPONSORED_PRODUCT_WEEK` description, but only if an admin hasn't edited it.

### Tested (curl, Harur Fresh Mart; live ads: Lay's chips, Everest Kashmirilal Chilli Powder via `prisma/seed-sponsored-search.ts`)

- `chilli powder`: Everest Ad 1st, Sakthi Featured 2nd, then organic. Each product appears once (200 products, 3 ad rows = its sizes).
- `chips`: Lay's Ad 1st. `masala` and `milk`: no ad (Everest chilli powder isn't a top-40 match for "masala"). `everest`: no ad (brand query). `chilli powder` sorted by price: no ad.
- Suggest `chilli` / `chilli pow`: the Everest row (Ad) is 2nd. `chips`: the Lay's row. `sak` (brand), `milk`, `chi` (completes to chicken): no ad.
- List "chilli powder / chips / Aachi chilli powder / milk": chilli powder offers Everest [Ad] then Sakthi [Featured], chips offers Lay's [Ad], all `PICK`. Aachi (named brand) and milk get no ad.

### Needs manual check

- The Ad label on search results and the list picker, and the suggestion row's Ad badge aligned in the row.
- Views and taps for search and suggestion ads show up in the brand campaign report (same banner counters).

## Next phases (decided 2026-10-21)

- **Phase 3:** `BRAND_TAB_SLOT` for the bottom nav: one brand per week across all stores. If unsold, it falls back to the org's own brand, then the daily rotation.
- **Phase 4:** reporting per surface (`BannerStatDaily` has no surface column yet, so search, suggest and Home views are counted together), plus rotation weighted by units bought.
- Stores get no revenue share of brand ads.
