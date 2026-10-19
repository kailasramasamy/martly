# Home sections (Zepto-style Home, Phases 1–3)

The customer Home is a server-driven list of sections. Each organisation arranges its own layout; every store in the
org shows the same layout, and a section with nothing in stock at a store hides itself there.

## How it works

- **API:** `GET /api/v1/home/:storeId/sections?cursor=` returns `{ sections, nextCursor, chrome }`, 8 layout
  entries per page.
  - `chrome` comes on the first page only: the festive header theme, the free-delivery threshold and the popup banner.
  - The legacy `GET /home/:storeId` is unchanged for old app builds.
- **Layout:**
  - `HomeSection` and `HomeSectionItem` rows hold each org's layout.
  - An org with no rows gets `DEFAULT_LAYOUT` (`services/home/default-layout.ts`).
  - Two automatic entries expand on the server:
    - `LIVE_CAMPAIGNS`: one campaign card per live PROMO collection that no section already places.
    - `OTHER_COLLECTIONS`: a product row per live collection that isn't placed anywhere else.
- **Resolvers:** `services/home/resolvers/*`. Each section type resolves to its payload, or to null to hide it.
- **Shared contract:** types, configs and labels live in `packages/shared/src/{constants,schemas,types}/home.ts`.
- **Admin:**
  - The Marketing → Home layout page lets you drag to reorder sections, toggle and edit them, and see which sections are hidden at a store.
  - The collection edit page has a "Show on Home as…" shortcut.
  - The API is at `/api/v1/home-layout` and needs the `CATALOG_COLLECTIONS` permission.
- **Mobile:**
  - `app/(tabs)/index.tsx` renders the sections in a virtualised `FlatList`, through the registry at `components/home/sections/index.tsx`. Unknown section types render nothing.
  - Also on Home: a back-to-top pill and a free-delivery progress bar in the bottom dock.

## Festive hero

- **Layout:**
  - One solid theme colour runs from the status bar down to the tiles, with white text.
  - A wide strip of tone-on-tone silhouettes sits under the search bar, carrying a three-line greeting: kicker, title (in the font chosen for the festival) and subtitle.
  - The festival's tiles come below on cream cards.
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
  - The first `DIRECTORY_WIDE_TILES` (2) tiles in each department are wide; the rest fill a 4-column grid.
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
- **Festival hero tile layout:**
  - The `FESTIVE_HERO` section config `tileLayout` is `GRID` (rows of three) or `FEATURE` (one tall tile plus a 2×2 block).
  - FEATURE is used only when a hero has exactly 5 stocked tiles, so it never hides one. Otherwise it falls back to GRID, per hero. Each hero carries the `tileLayout` it got.
  - The legacy endpoint and the festival screen always use GRID.

## Seed

`cd apps/api && npx tsx prisma/seed-home-layout.ts [--regen-art] [--hero]` builds the showcase for Demo Grocers / Harur Fresh Mart:
- Phase 2 sections from `prisma/seed-home-phase2.ts`: an "Everyday picks" tabbed row, "Pocket-friendly deals" (Under ₹19/29/49/99), Cadbury and Amul brand cards, and a "Shop by aisle" directory
- Phase 3 from `prisma/seed-home-phase3.ts`: "Explore by mood" (8 tiles) and "Shop by store" (5 mini-stores), each tile backed by its own collection, with painted tile art.
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
- **Phases 4–5** (ads and offers, personalisation and caching) aren't built yet.
