# Brand Promotion

Brands get ahead in a store in three ways:

- **Store brand** (owner's switch): the organisation's own brands, plus **unbranded staples** (rice, dal, flour… in Grocery & Staples), which are the store's own packs. They are boosted and marked "Our brand".
- **Featured by Martly:** brands Martly features in one organisation's stores, boosted and marked "Featured". Only super admin sets these.
- **Paid brand campaigns:** booked **only by Martly super admin**, with the brand paying Martly. They get fixed slots marked "Ad": `SPONSORED_PRODUCT` in Home, categories, search, suggestions and list orders, plus banners and takeovers. Stores can't switch them off, block a brand, or opt out of brand promotions, and get no share of the revenue (the sales lift is theirs).

Paid ads and boosted brands never compete for the same position: paid products take fixed slots, and boosted brands move up inside the ranking.

## Who controls what (since 2026-10-21)

| | Martly super admin | Store owner | Brand partner (portal) |
|---|---|---|---|
| Book / edit / cancel brand campaigns | ✓ (Brand campaigns) | — | — (read-only portal) |
| Pay for a campaign | Record an offline payment | — | ✓ Razorpay checkout from the portal |
| Campaign targeting: all stores / states / districts / selected stores | ✓ | — | — |
| Featured brands per organisation | ✓ (organisation page) | Sees them (read-only) | — |
| Store state and district (decides region targeting) | ✓ | — (ignored by the API) | — |
| "Promote my own brands" | — | ✓ | — |
| Block brands / switch off brand ads / opt out of brand promotions | Removed | Removed | — |

**Targeting:** `targetStoreIds`, `targetStates` (`INDIAN_STATES` names) and `targetDistricts` (`"Tamil Nadu:Dharmapuri"`) on `BrandCampaign`, copied to its banner at go-live. No targets means every store. Otherwise a store qualifies if **any** target matches it, and it must still stock the brand (`services/brand-campaigns/targeting.ts`). Brand discount promotions are per organisation: an org takes part if a targeted store stocks the brand, and its price cut then applies in all its stores. `GET /brand-campaigns/regions` lists the state and district pairs that have stores.

Migrations: `20261021180000_brand_ad_regions` (store region with Dharmapuri backfill, campaign and banner targets, drops `allow_brand_ads`) and `20261021181000_drop_store_brand_ad_controls` (drops brand blocks and promotion opt-outs; prod had none).

## Rules

1. **Relevance first.** A boost only reorders products that already match. A featured masala brand never shows up for "milk".
2. **No flooding.** Search gives a boosted brand weighted turns. Category listings give boosted brands every third slot.
3. **Always labelled.** Boosted products carry a badge on the card, and paid ones say "Ad".
4. **The shopper's choice wins.** A brand they named, or one they've bought before, beats any boost in voice, list and photo orders. A boosted brand is only ever the first option to pick from, never added for them.

## Phase 1: store-promoted brands (built 2026-10-21)

### Data

- `Organization.boostOwnBrands` (default `true`): brands with `Brand.organizationId` = the org, and unbranded products in the `grocery-staples` department (`STORE_BRAND_DEPARTMENT_SLUG`), are "Our brand". Unbranded fruit, veg, meat and so on are not.
- `OrgBrandFeature (organizationId, brandId)`: brands Martly features in the organisation, up to 50 (`GET/PUT /marketing/brand-ads/orgs/:organizationId/featured`, super admin).
- `storeBrandBoost(prisma, storeId)` (`apps/api/src/services/brand-boost.ts`) returns `{ brands: Map<brandId, "OWN" | "FEATURED">, stapleSubcategoryIds }`. Own wins if a brand is both. In search, unbranded staples take turns together as one brand.

### Where it applies

| Surface | Effect |
|---|---|
| Search (`searchProducts`) | In the weighted brand turns, the store's own brand and staples rank with popularity 106 (a turn every 14 points) and featured brands with 105 (every 15). Against a 100-popularity leader (every 20), they take the first turn, and own beats featured. Relevance bands (intent, name tier, taxonomy) are unchanged |
| Category listings (`GET /stores/:id/products?categoryId=`) | With no sort and no brand filter, boosted rows take slots 1, 4, 7… until they run out (`boostedListingPage`; the slot math pages in the DB). Sorting by price turns the boost off, but the badge stays |
| Voice / list / photo to cart | Search order includes the boost, so an unbranded line ("chilli powder") lists the featured brand first among its options (`PICK`), never `MATCHED`. The boost is loaded once per run |
| Cards | `brandPick: "OWN" | "FEATURED"` on store-product rows; `BrandPickBadge` in `CompactProductCard` / `FeaturedProductCard` ("Our brand" / "Featured", Tamil included). An Ad badge replaces it on a sponsored row |

### Owner controls

`GET /api/v1/marketing/brand-ads` returns `{ boostOwnBrands, featuredBrands }`, and `PUT` takes `{ boostOwnBrands }`. `GET /marketing/brand-ads/campaigns` lists the campaigns reaching the org's stores (read-only).
- Admin: Marketing → Marketing plan → Brand ads.
- Mobile Manage: More → Brand ads.

## Tested (curl, Harur Fresh Mart, Demo Grocers featuring Sakthi Masala)

- `chilli powder`: Sakthi went from 11th to 1st. Its other products show at 3, 10 and 15 for "masala", not as one block.
- `turmeric`: the fresh turmeric intent band still leads, and Sakthi Turmeric Powder is 3rd. `milk` didn't change.
- Spices category, 1,580 rows: `S..S..S..` pattern. Paging through every page returns each row exactly once, and Sakthi's 67 rows sit within the first 200. A `price_asc` sort isn't boosted.
- List to cart "chilli powder / turmeric powder / MDH garam masala": the first two are `PICK` with Sakthi first and flagged. MDH is `MATCHED`.
- Own brand (Test Mills, "multigrain atta"): 14th with `boostOwnBrands` off, 2nd with it on, with the label removed when off.
- Store brand staples: `toor dal`, `atta` and `rice` lead with the unbranded packs ("Our brand"), interleaved with Tata, Fortune and India Gate. `tomato` doesn't change (unbranded veg isn't store brand).

Seed: `cd apps/api && npx tsx prisma/seed-brand-boost.ts` (features Sakthi Masala for the first org).

## Needs manual check

- The badge on cards in search, the category screen and the list-to-cart picker (English and Tamil).
- Owner, in admin and Manage → Brand ads: the own-brand switch saves, and featured brands and campaigns are read-only.
- Super admin: featured brands on the organisation page; "Where it runs" (all stores / regions / selected stores) on the campaign form; state and district on the store form.
- Brand portal: no create, edit or cancel; Pay still works.

## Phase 2: sponsored products in search, suggestions and list orders (built 2026-10-21)

The existing `SPONSORED_PRODUCT` booking (one product, weekly) now also runs here. Ads come from `liveSponsored`, so campaign targeting, the per-category slot cap, the in-stock check and the banner's view and tap counts all apply as before. Placement logic is in `apps/api/src/services/sponsored-search.ts`.

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
- **Store-brand packs:** replace generic staples with each store's own branded packs. Photograph the front and back of a store's pack, then have AI make per-product images with the store brand. Not started.
