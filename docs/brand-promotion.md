# Brand Promotion

Brands get ahead in a store in three ways:

- **Store brand** (owner's switch): the organisation's own brands, plus **unbranded staples** (rice, dal, flour… in Grocery & Staples), which are the store's own packs. They are boosted and marked "Our brand".
- **Featured brand (paid):** a brand campaign package (`BRAND_FEATURE`, "Featured brand", ₹3,000/week). It's bought for one category: while it's live, the brand's products in that category are boosted and marked "Featured" in the stores it targets. See [Featured brands](#featured-brands-paid-since-2026-10-22).
- **Paid brand campaigns:** booked **only by Martly super admin**, with the brand paying Martly. They get fixed slots marked "Ad": `SPONSORED_PRODUCT` in Home, categories, search, suggestions and list orders, plus banners and takeovers. Stores can't switch them off, block a brand, or opt out of brand promotions, and get no share of the revenue (the sales lift is theirs).

Paid ads and boosted brands never compete for the same position: paid products take fixed slots, and boosted brands move up inside the ranking.

## Who controls what (since 2026-10-21)

| | Martly super admin | Store owner | Brand partner (portal) |
|---|---|---|---|
| Book / edit / cancel brand campaigns | ✓ (Brand campaigns) | — | — (read-only portal) |
| Pay for a campaign | Record an offline payment | — | ✓ Razorpay checkout from the portal |
| Campaign targeting: all stores / states / districts / selected stores | ✓ | — | — |
| Featured brands (a campaign package, aimed like any campaign) | ✓ (Brand campaigns) | Sees them (read-only) | Follows and pays, like other campaigns |
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
- Featured brands: `LIVE` campaigns on a `BRAND_FEATURE` package aimed at the store (see below). This replaced the per-organisation `OrgBrandFeature` list on 2026-10-22.
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

Seed: `cd apps/api && npx tsx prisma/seed-ad-pricing.ts && npx tsx prisma/seed-brand-boost.ts` (books Sakthi Masala as a live featured brand in all stores for a week).

## Needs manual check

- The badge on cards in search, the category screen and the list-to-cart picker (English and Tamil).
- Owner, in admin and Manage → Brand ads: the own-brand switch saves, and featured brands and campaigns are read-only.
- Super admin: book a Featured brand package (Brand campaigns → New campaign); "Where it runs" (all stores / regions / selected stores) on the campaign form; state and district on the store form.
- Brand portal: no create, edit or cancel; Pay still works.

## Featured brands (paid, since 2026-10-22)

Brands pay Martly to be featured, so it's a brand campaign package rather than a per-organisation setting:

- **Package:** `AdProduct` kind `BRAND_FEATURE`, code `FEATURED_BRAND_WEEK`, ₹3,000 per week **per category**, with no placement. It's booked, paid (Razorpay or offline) and reviewed like other campaigns, with a category (`BrandCampaign.categoryId`, which the brand must have products in) and "Where it runs" (all stores, states, districts or selected stores). A brand wanting two categories books two features.
- **No creative.** `BrandCampaign.placement` is null. The form asks only for a campaign name, approval doesn't need an image, art generation is refused, and going live makes no banner, promo or push. The "scheduled" staff alert says the brand will show as Featured.
- **Ranking:** `storeBrandBoost` reads `LIVE` `BRAND_FEATURE` campaigns aimed at the store (`aimedAtStore`, shared with banners) into `featured: { brandId, subcategoryIds }[]` (the category's subcategories). Only those (brand, subcategory) products get `FEATURED`: search matches the pairs in SQL (`featuredPairs`), and the listing split in `boostSplit` does the same. A store's own brand still wins.
- **Where shoppers see it:** search results, department, category and subcategory pages (default order), and speak, list and photo orders (first option for an unbranded line, never auto-added), with the Featured badge on those cards. There's no Home card, banner, suggestion row or push.
- **Slots:** `MarketingConfig.featuredBrandSlots` (default 2; Marketing → Pricing → "Featured brands per category at once") caps how many run at once **in one category**. Categories don't limit each other, because brands only dilute each other within an aisle. The same brand can't hold two overlapping features in one category (it would pay twice for nothing). Different categories or regions are fine. Both checks run under the slot's advisory lock. When a slot is full, `availability` also returns `nextStartsAt`: the earliest start from which the whole campaign length fits (always the moment a held campaign ends). The booking form shows "Fully booked · next opening Thu, 29 Oct" with a **Start then** button, and a refused save names the date too. This applies to every package, banners included.
- **Owners:** `featuredBrands` in `GET /marketing/brand-ads` lists brands with a live feature reaching one of the org's stores that stocks them. The feature also appears in the read-only campaign list.

Migration `20261022100000_paid_featured_brands`: adds the enum value, makes `brand_campaigns.placement` nullable, adds `featured_brand_slots` (default 2), and drops `org_brand_features` (prod had no rows).

**Tested (curl):** booked MDH for one Dharmapuri store, marked it paid offline and approved it. It went `LIVE` at once with no banner, promo or push. MDH was Featured in that store's chilli powder search and plain in Harur's. Generate-art was refused. A banner booking without art or a brief is still refused.

Per category: Sakthi featured in Spices & Masala is Featured on its 67 spice products and plain on its pickles, flours and oil. Paging through Spices (1,577 rows) and Pickles (328) returns each row exactly once, `F..F..` in Spices and nothing in Pickles. Booking with no category was refused, and so was a brand with no products in the category (Aachi in biscuits). With Sakthi and Aachi in Spices, a 3rd Spices feature was refused while Sakthi in Pickles was accepted. With a Spices slot free, a second Sakthi Spices booking was refused ("already featured in that category"). Taking Sakthi Pickles live made "mango pickle" lead with Sakthi, Featured, alongside its spices.

**Needs manual check:** the admin campaign form with the Featured brand package (category picker, campaign name, targeting); the campaign page's "Featured brand" card; the "Featured brands at once" field on Pricing.

## Category takeover art (since 2026-10-22)

A takeover shows as a 2:1 strip (140px tall, full width) at the top of its category page, marked Sponsored. It doesn't reorder products; that's what a Featured brand is for. AI art for a `CATEGORY_TOP` campaign uses the `wide` format (`services/seasonal/banner-art.ts`): it's painted on the 3:2 canvas, the model's widest, and the prompt keeps a plain margin above the headline and below the subjects. The image is then trimmed to 1536×768, so the app shows it uncropped. Upload guidance asks for 2:1, at least 1200 × 600, with text kept to the middle. Posters stay 2:3, and carousel banners stay 3:2.

Local demo: Britannia "Biscuits for every chai" on Biscuits & Cookies (paid offline as DEMO-LOCAL-003).

## Changing a booked campaign (since 2026-10-22)

| Status | What super admin can change (admin → campaign → Edit) |
|---|---|
| Draft / Awaiting payment | Everything |
| In review (paid) | Start date, where it runs, banner and copy |
| Scheduled (approved) | Start date and where it runs only; it stays approved |
| Live / Ended | Nothing |

Once a campaign is paid, its package, brand and weeks are locked (the API ignores them), so moving the start date moves the end date by the same length. A new window must fit the slot limit (and for a featured brand, not overlap the brand's other feature). Moving a scheduled campaign sends the owners it reaches "… campaign now starts <date> in your stores", and moving it to today launches it at once (`launchOrAnnounce`, which approval also uses). The brand portal stays read-only.

**Tested (curl):** paid in-review feature: the date moved, and a package or weeks change in the body was ignored. Approval sent "starts Thu, 12 Nov". Scheduled: moved to 20 Nov with Tamil Nadu targeting, the title change was ignored, the end date kept 2 weeks, and the alert said "now starts Fri, 20 Nov". A past date was refused. Moving it to today made it `LIVE`. Editing a live campaign was refused.

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

## Phase 3: brand tab slot (built 2026-10-22)

The last slot of the shopper app's bottom bar shows one brand's logo and opens its brand page. Unlike other paid placements it carries no Ad badge (decided 2026-10-23): a brand logo in the nav reads as a brand placement, and the badge cluttered the bar.

- **Package:** `BRAND_TAB_SLOT`, code `BRAND_TAB_WEEK`, "Brand tab slot", ₹10,000 per week, on the new `BRAND_TAB` placement. Booked, paid and approved like other campaigns, with "Where it runs". The brand's logo is the creative: booking copies it, refuses a brand without one, and art generation is refused.
- **One brand at a time:** slot limit `BRAND_TAB: { BRAND: 1 }`, network-wide, so a second booking is refused with the next opening date.
- **Going live** makes a `BRAND_TAB` banner row (like sponsored products), so targeting, the "store stocks the brand" check, views and taps, and campaign results all reuse the banner feed. There's no push to customers.
- **What the slot shows** (`services/brand-spotlight.ts`, `GET /brands/store/:storeId/spotlight`):
  1. a live tab slot aimed at the store, returned with `sponsored: { bannerId }`
  2. otherwise the organisation's own brand with a logo that the store stocks, when "Promote my own brands" is on
  3. otherwise the daily rotation through the store's 5 best-known stocked brand stores
- **App:** `BrandTabSlot` records a view once per session and a tap per press for a paid logo. The slot refetches when Home is pulled to refresh and when the app returns to the foreground (`refreshBrandSpotlight`), so a new booking or the next day's rotation shows without a restart.
- **Migrations:** `20261022140000_brand_tab_slot` (enum values) and `20261022140100_brand_package_rows`. The second adds the Featured brand (₹4,000) and Brand tab slot (₹10,000) packages to prod, plus the slot limit. It skips rows that already exist.

**Tested (curl):** before booking, Harur's spotlight was Tata Salt (rotation). Britannia booked, paid offline and approved went Live with its logo and no push, and the spotlight became Britannia with `sponsored`. A brand without a logo was refused. A second booking was refused ("the next opening starts Thu, 29 Oct"). Generate-art was refused. Tab views and taps showed in the campaign's results. Local demo: Britannia tab slot (DEMO-TAB-1).

**Needs manual check:** the phone's bottom bar shows the Britannia logo, and tapping opens the Britannia brand page. In admin, the booking form with the Brand tab slot package shows only a campaign name, and the campaign page shows the logo card.

## Next phases (decided 2026-10-21)

- **Phase 4:** reporting per surface (`BannerStatDaily` has no surface column yet, so search, suggest and Home views are counted together), plus rotation weighted by units bought.
- **Store-brand packs:** replace generic staples with each store's own branded packs. Photograph the front and back of a store's pack, then have AI make per-product images with the store brand. Not started.
