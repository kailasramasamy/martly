# Home sections (Zepto-style Home, Phases 1–4)

The customer Home is a server-driven list of sections. Each organisation arranges its own layout; every store in the
org shows the same layout, and a section with nothing in stock at a store hides itself there.

## How it works

- **API:** `GET /api/v1/home/:storeId/sections?cursor=` returns `{ sections, nextCursor, chrome }`, 8 layout
  entries per page.
  - `chrome` comes on the first page only: the festive header theme, the search hints and the free-delivery threshold.
  - The legacy `GET /home/:storeId` is unchanged for old app builds.
- **Layout:**
  - `HomeSection` and `HomeSectionItem` rows hold each org's layout.
  - An org with no rows gets `DEFAULT_LAYOUT` (`services/home/default-layout.ts`).
  - Two automatic entries expand on the server:
    - `LIVE_CAMPAIGNS`: one campaign card per live PROMO collection that no section already places.
    - `OTHER_COLLECTIONS`: a product row per live collection that isn't placed anywhere else.
  - The server enforces two placements on every layout (`services/home/layout.ts`, since 2026-10-21):
    - `HERO_BANNERS` is pinned right after `DEPARTMENT_GRID` (or `CATEGORY_DIRECTORY`), so shoppers can browse before the ads (since 2026-10-24). A layout with no directory keeps it right under `FESTIVE_HERO`, at the top when there's no festival. It is pinned even if a saved layout moved or dropped it, because it carries paid brand banners; brand slides lead it.
    - Campaign cards (placed or `LIVE_CAMPAIGNS`) are spread through the product rows (`PRODUCT_ROW`, `TABBED_ROW`) instead of stacked: brand-paid cards first, then a card for each live festival the single hero has no room for (unless a section already shows it), the first card after the first row, then one every two rows (closer when there are more cards than rows).
- **Resolvers:** `services/home/resolvers/*`. Each section type resolves to its payload, or to null to hide it.
- **Shared contract:** types, configs and labels live in `packages/shared/src/{constants,schemas,types}/home.ts`.
- **Admin:**
  - The Marketing → Home layout page lets you drag to reorder sections, toggle and edit them, and see which sections are hidden at a store.
  - The collection edit page has a "Show on Home as…" shortcut.
  - The API is at `/api/v1/home-layout` and needs the `CATALOG_COLLECTIONS` permission.
- **Mobile:**
  - `app/(tabs)/index.tsx` renders the sections in a virtualised `FlatList`, through the registry at `components/home/sections/index.tsx`. Unknown section types render nothing.
  - Also on Home: a back-to-top pill and a free-delivery progress bar in the bottom dock.

## Default order (since 2026-10-24)

Modelled on Instamart's and Blinkit's Home, which both show the category directory on screens 2–4 and keep ads lower:

1. `FESTIVE_HERO`, `OFFERS`, `MEMBER_CHIPS`
2. `BESTSELLER_CATEGORIES`: the store's 6 best-selling categories (30-day units here, then stocked count), each card a 2×2 of its own top sellers, a "+N more" pill and the name. It hides with fewer than 3 cards. It replaced the hand-picked "Best Sellers" row.
3. `BUY_AGAIN`: the shopper's repeat buys (shows only for signed-in shoppers with past orders).
4. `DEPARTMENT_GRID`: every department as one 4-column grid (16 tiles), each opening its department. A tabbed and a full per-department aisle directory were both tried on 2026-10-24 and dropped as too long or too hidden; the aisle directory (`CATEGORY_DIRECTORY`) stays available but is switched off on Demo Grocers' Home.
5. `HERO_BANNERS` (pinned here)
6. Campaign cards, product shelves and the rest

`prisma/reorder-home-layout.ts` moved saved layouts to this order: it adds the bestseller cards, moves buy again, the department grid and the banners up, and switches off the aisle directory, the Best Sellers row and its collection (rows kept, `isActive=false`).

**Product shelves (`PRODUCT_ROW`):** a 3-column grid of 6 products (whole rows of 3; a shelf with fewer than 3 shows them as they are), then a "See all N products" pill previewing 3 product images. A sponsored product takes a slot in the shelf rather than adding one. The `maxProducts` config was removed. Older app builds draw the same 6 products as a rail.

**Deal signals on product cards (since 2026-10-24, `apps/mobile/lib/deal.ts`):**
- A card strikes the promo's original price while a store promo runs, else the printed MRP when the price is below it (~90% of listings), else nothing.
- Label: "₹N OFF" when the saving is at least ₹50 and that reads bigger than the percentage; otherwise "N% OFF" for a promo or "N% OFF on MRP". A promo keeps the amber pill; an MRP saving is plain blue text.
- A saving of 20% or more puts the price on a yellow highlighter.
- Home shelves (`PRODUCT_ROW`) add an "All <aisle> ›" chip that opens the product's subcategory; other screens don't (the `aisleLink` prop on `ProductList`).

**Theme bands (`THEME_BAND`, since 2026-10-24):**
- A full-width pastel band between shelves: title and subtitle on the left, cut-out art on the right, then 2–4 aisle tiles.
- Config `{ tint, imageUrl? }`. Items: each tile opens exactly one subcategory (`subcategoryIds: [id]`, no collection); the items endpoint rejects anything else.
- A tile shows only while its aisle has stock at the store, with the aisle's own picture when the tile has none. The band hides with fewer than 2 tiles.
- Edited in admin (band colour, art, tiles). Mobile Manage can retitle, reorder and toggle it.
- `prisma/seed-home-bands.ts` adds Demo Grocers' three: Pooja corner, Breakfast sorted, Home care refresh.

**Store specials (`STORE_SPECIALS`, since 2026-10-24):** a built-in block that draws the store's own ranges (collections of type Store special) as the search screen's spotlight cards. See `docs/store-specials.md`.

**Regional pantry picks:** a `PRODUCT_ROW` on the collection "Regional pantry picks", built by `prisma/seed-regional-pantry.ts` from South Indian brands the store stocks (MTR, Sakthi, Eastern, GRB, Aavin, Gold Winner, Idhayam…) in pantry aisles, best sellers first with at most 3 of a brand in the first 12. It sits right below the hero banners. Brands carry no region field, so the brand list lives in the script; admins edit the collection like any other.

## Festive hero

- **Layout (pastel since 2026-10-24, see `docs/festive-home-hero.md`):**
  - A pale wash of the festival hue runs from the status bar through the block, with deep-ink text.
  - A faint silhouette strip rises behind the header's pills; the kicker and title sit on the left with a See all pill.
  - The festival's tiles follow as white cards in one sideways row.
- **The hero designer (Claude)** chooses:
  - the theme colour, kept within a contrast band against white
  - the silhouette scene
  - the font: PLAYFAIR, YATRA, KALAM or LOBSTER
  - the three greeting lines, in English and Tamil
  - the tiles
- **Strip art:** `services/seasonal/hero-art.ts` handles it.
  - It paints grey silhouettes on flat grey with gpt-image-2.5-flare at medium quality.
  - It recolours them into tones of the theme colour and crops to the art.
  - The top and bottom fade relative to the art itself.
  - A self-check repaints the strip once if the backdrop isn't flat.
- **Heroes made before this change** still use tall painted art (their `heroTheme` has `ornamentDepth`). The app hides that art, so regenerate them with `POST /collections/:id/regenerate-hero`.

## Campaign card and campaign screen

- **Card:**
  - One compact card on its theme colour.
  - The headline, countdown and "Shop all" pill sit on the left; a transparent cut-out of the products sits on the right, with the offer stamp on its corner.
  - Below that, fixed-size aisle chips: packs on the left, name and count on the right.
- **Aisles:** grouped from the collection's in-stock items, by category, or by subcategory when there are too few categories.
- **Card art:** a transparent cut-out (seed `paintArt(..., true)` trims it), so it sits on any theme colour.
- **Tapping:**
  - The card opens `/collection/[id]`.
  - An aisle opens the same screen with that aisle's subcategories pre-selected.
- **Campaign screen:**
  - `GET /collections/:id/products` returns `collection.campaign` (art, theme and offer, from `services/home/campaign-look.ts`) and, on page 1, `collection.aisles`.
  - The screen has a themed navigation bar with only a back arrow, a deeper header that fades into the page, the cut-out and stamp, aisle filter chips, and elevated white product cards.

## Phase 2 section types

Every type below hides itself at a store with nothing to show. `SECTION_COLLECTION` (shared constants) says whether a
type must, may, or must not name a collection on the section; the layout API enforces it.

- **Tabbed row (`TABBED_ROW`):**
  - Each tab is a section item with its own collection.
  - Tabs whose collection has ended or has no stock at the store are dropped.
  - A tab without an image uses its collection's image, or else the first in-stock product's image.
  - The first tab's products come with the section. The app loads the others from `GET /collections/:id/products` when they're picked.
  - Rail styles: `ICON_CARD`, `ICON_UNDERLINE` and `PILL`.
- **Price-band deals (`PRICE_BAND_DEALS`):**
  - 2 to 5 bands ("Under ₹19", …) with a `maxPrice` each; `null` means any price.
  - Products come from the whole store's in-stock catalog, or from the section's collection if one is set.
  - The price is the one the shopper pays, worked out the same way as `calculateEffectivePrice`: the store row's live discount, else the size's live discount, else the price.
  - Each product carries only its sizes within the band, ordered by biggest saving.
  - Category chips are the categories with the most products in the band.
  - Other bands and chips: `GET /home/:storeId/deals?sectionId=&band=&categoryId=&page=` returns `{ chips, products, total }`, 20 products per page.
  - The headline ("Add any 10 items") is a label only, since there is no mix-and-match pricing.
- **Brand card (`BRAND_CARD`):**
  - `config.brandId` sets the brand, which must be master or the organisation's own. The card shows that brand's 3 in-stock products the store sold most in the last 90 days.
  - Products nobody has bought yet rotate daily.
  - An optional collection narrows the products.
  - The tint defaults to the brand's theme colour.
  - "See all" opens the brand screen, or the collection when one is set.
  - The card hides when fewer than 3 products are in stock.
- **Category directory (`CATEGORY_DIRECTORY`):**
  - Shows the departments in `config.departmentIds`, in the admin's order, or all departments when the list is empty.
  - Only categories with stock at the store are listed.
  - Every tile is a square in a 4-column grid on one quiet tile colour (wide tiles were removed on 2026-10-24).
- **Mobile Manage → Marketing → Home layout:**
  - Reorder with up/down, switch sections on and off, delete, and see the "hidden at store" hint.
  - Per-type forms for the product row and all Phase 2 types.

## Phase 3: tiles, art and the themed top

- **Explore tiles (`EXPLORE_GRID`) and Shop by store (`STORE_GRID`):**
  - Each tile is a section item that opens its collection, optionally narrowed to aisles (`subcategoryIds`). A wide tile spans 2 columns on Explore, and sits in the 2-up row on Shop by store.
  - The layout API rejects a tile without a collection.
  - Tiles whose collection has ended or has no stock at the store are dropped, and the section hides below 2 tiles.
  - Tile image fallback: the tile's art, then the collection's image, then a pack cluster of up to 3 in-stock product images (`packImages`).
- **Tile art:**
  - `POST /home-layout/:id/art` (`{ itemIds?, repaint? }`) paints a transparent cut-out for each tile without an image, 3 at a time.
  - It uses `paintTile` from `services/seasonal/hero-art.ts`, prompted with the tile label and its collection's aisles, and stores the images under `home/tiles/` on S3.
  - It's in the admin only, because it costs image credits.
- **Search hints:**
  - `chrome.searchHints` holds the live festival's first 2 aisles, then the store's most-searched terms from the last 14 days, topped up from `DEFAULT_SEARCH_HINTS`. There are at most 8.
  - A term only counts once 3 different signed-in shoppers have searched it, it returned results, and it has no long digit runs. This keeps any one shopper's searches (names, phone numbers) out of everyone else's search bar.
- **Festival hero tiles:** since 2026-10-24 the hero shows every stocked tile in one sideways-scrolling row, so `FESTIVE_HERO` has no config. The old `tileLayout` setting (GRID or FEATURE) was removed; see `docs/festive-home-hero.md`.

## Phase 4: offers and ads

- **Offers for you (`OFFERS`):**
  - Coupons marked `showOnHome` (with an optional `title` headline) that the shopper can still use at the store.
  - "Can still use" means: live, within their limits, for this organisation or platform-wide, and not used up by this shopper.
  - Built by `services/coupon-offers.ts`. Home shows up to 6.
  - Tapping Apply saves the coupon for the cart, and checkout applies it.
  - Checkout lists the same offers from `GET /coupons/available?storeId&orderAmount`, with the ones that apply first and "add ₹X more" on the rest.
- **Coupon check:** `services/coupons.ts` `checkCoupon` is the only place a coupon is judged. The code box (`/coupons/validate`), checkout (order create) and the offers list all use it.
  - It fixed a bug: checkout didn't check the coupon's organisation, so a code from one organisation applied at another's store.
- **Brand posters (`BRAND_POSTERS`):**
  - Tall 2:3 brand posters in a Home rail, in the new `HOME_POSTER` banner placement.
  - Brands book the `BRAND_POSTER_WEEK` package (₹6,000 a week). Up to 4 run at once.
  - "Generate with AI" paints portrait art for posters (`format: "portrait"` in the banner pipeline).
- **Sponsored products:**
  - Brands book `SPONSORED_PRODUCT_WEEK` (₹3,000 a week, 2 per category) for one of their own products.
  - The campaign runs in that product's category, and its photo is the creative.
  - While live it is a `SPONSORED_PRODUCT` banner. It is served only where the store stocks the product.
  - It goes into position 2 (after the first product's sizes) of:
    - Home product rows and tabbed rows whose products are mostly in its category. A product already in the row moves rather than appearing twice. Each ad shows at most once per Home scroll: the cursor carries the ads already shown.
    - Page 1 of plain category listings whose aisles include its category. It's kept out of the regular results on every page. It is not added when the shopper filters or sorts.
  - Rows are marked `sponsored: { bannerId }`. The app shows an "Ad" badge and counts views and taps as banner events, so campaign Results and caps work unchanged.
- **Ad rules:** every ad comes from `storeBanners()`, so the org's brand-ads switch, blocked brands, slot limits and view caps apply.
  - Slot limits for `CATEGORY_TOP` and `SPONSORED_PRODUCT` count per category, both when booking and in the feed.

## Seed

`cd apps/api && npx tsx prisma/seed-home-layout.ts [--regen-art] [--hero]` builds the showcase for Demo Grocers / Harur Fresh Mart:
- Phase 2 sections from `prisma/seed-home-phase2.ts`: an "Everyday picks" tabbed row, "Pocket-friendly deals" (Under ₹19/29/49/99), Cadbury and Amul brand cards, and a "Shop by aisle" directory
- Phase 3 from `prisma/seed-home-phase3.ts`: "Explore by mood" (8 tiles) and "Shop by store" (5 mini-stores), each tile backed by its own collection, with painted tile art.
- Phase 4 from `prisma/seed-home-phase4.ts`: three advertised coupons (WELCOME50, SAVE20, SNACK30), live Cadbury and Amul posters with painted portrait art, and a live Lay's sponsored product (shown in the "Crunch time" row and on the Chips & Crisps listing)
- three campaign cards: Personal Care Weekend, Snack Fest and Breakfast Combo
- product rows in all three header styles
- a repaint of the Navratri hero, with `--hero`

Art already in place is reused unless `--regen-art` is passed.

## Tested (local, iPhone screenshots)

- **Sections endpoint:** paging, the `chrome` block, the legacy endpoint returning unchanged keys, and no duplicate promo cards.
- **Festive top:**
  - Navratri and Diwali heroes are seamless, with no edge at the strip.
  - Tap targets go to the right places.
- **Campaign cards:** cut-out art, theme colours, the countdown, and taps on the card and on aisles.
- **Campaign screen:** theme, header fade, stamp, aisle chips (filtering in place) and elevated cards.

## Needs manual verification

- **Admin Home layout page:** drag and save, and the "hidden at store" hint (built and type-checked, not yet run in a browser).
- **Old-style heroes:** regenerate them after deploying, including prod's festival heroes.
- **Phase 5** (personalisation and caching) isn't built yet.
