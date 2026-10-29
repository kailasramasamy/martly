# martlyshop.in (apps/web)

The public website. Shoppers land on a shop, not a pitch: they browse the products and prices of a store picked for them, the same way the app does (see docs/store-resolution.md). Ordering happens in the app for now; ordering on the web is Phase 3.

## How it works

- **Stack:** TanStack Start (React 19, server-rendered) + Tailwind 4, the same setup as quartex.in. Every page arrives as full HTML, so search engines read it without running JavaScript.
- **Data:** route loaders call server functions (`src/lib/api.ts`) that fetch the Martly API from the server, so the API needs no CORS entry for the site.
- **The shopper's store:** cookies `martly_store` (store id) and `martly_town` (town slug), httpOnly, one year. Server functions pass them to the API as `?store=&town=`. With no cookie (first visit, Googlebot) the API picks the default: the town's main store, else Martly's. The header chip (the store's logo, its name and 📍 town) opens a picker: "Use my location" (browser geolocation → `/stores/resolve`) or a store per live town. Opening `/{town}/{store}` also makes that store the shopper's. **First visit:** while no store is saved, the picker opens by itself after the page loads, on a phone as a bottom sheet. It adds "Continue with {store}", and closing it any way (Continue, ✕, Esc, tapping outside) saves the store shown, so it asks only once. It isn't in the server HTML, and it never opens on a store's own page, because that page saves the store. `isStoreChosen` in `lib/api.ts` reads the httpOnly cookie for the client. No IP guess yet: if the site goes behind Cloudflare, its free visitor-location header could pre-pick the town.
- **API** (`apps/api/src/routes/web/index.ts`, services in `services/web-shop/`), all public and returning only public fields:
  - `GET /web/home`: live towns and their stores (root loader: header picker + footer).
  - `GET /web/departments`: the departments the store stocks (`storeDepartments`), for the department bar (root loader).
  - `GET /web/stores/:town/:store`: one live store and its town.
  - `GET /web/home-sections?cursor=`: the app's Home sections at the store, a page at a time with the app's cursor (see "Home" below).
  - `GET /web/collections/:slug?aisle=&tile=&page=`: a collection or festival: title, art and theme (`campaignLook`, else the festival's hero theme), aisle chips, 24 products a page in the collection's order. Festivals use their own tiles as chips (`?tile=`); other collections group what the store stocks into aisles (`?aisle=` subcategory slugs, comma separated).
  - `GET /web/brands/:slug?page=`: a brand's products at the store; 404 when the store has none.
  - `GET /web/offers/buy-get?category=&page=`: every buy X get Y offer (`buyGetPage`), category chips by slug.
  - `GET /web/best-sellers`: the store's top 30 over 30 days (`mostBought`).
  - `GET /web/deals/:sectionId?band=&category=&page=`: a Home price-band section in full (`dealsSection` + `bandPage`, shared with the app's `/home/:storeId/deals`).
  - `GET /web/departments/:department` and `/:department/:category?sub=&page=`: a shelf per category; a category's products 24 a page, with subcategory chips and counts.
  - `GET /web/brands`: every brand the store stocks, A to Z, with product counts and the departments each covers; `popular` picks the 12 best known (brand `popularity`, then themed, then most stocked). martlyshop.in/brands draws it as popular brands, a find-a-brand box, department chips and an A–Z directory (filtering runs in the browser); Home's brand rail links to it under "See all".
  - `GET /web/brands/:slug?sub=&…`: a brand's products at the store with its subcategories (largest first) as chips, and the same filters as categories.
  - `GET /web/stores/:town/:store/brand?sub=&…`: the store as a brand, as in the app (`ownBrandPage`): its organisation's brands and the unbranded staples it packs (`ownProductWhere`), priced at that store, with the same chips and filters. Drawn at martlyshop.in/{town}/{store}/brand; 404 when the store doesn't promote its own brand.
  - Category filters (`category-filters.ts`): `brand=` (slugs, comma separated), `price=50-100` (`500-` and up, `-50` under; min included, max not), `off=10|25|40|60` (% off MRP or more), `rating=3|4` (average of approved reviews), `offers=1` (buy X get Y), `food=`, `stock=1`, `sort=relevance|price_asc|price_desc|discount`.
    - The category's products are priced in memory with `toCard` (the largest is ~1.2K), so the filters see exactly the price, % off and offer the cards show. A product's price is its cheapest pack; % off, offer and stock count if any pack has them.
    - Facets follow Amazon's rule: each group is counted with every *other* filter applied. Picked brands stay listed at 0 so they can be unticked. Price bands sit at the category's 20/40/60/80% price quantiles, snapped to round rupees, and don't move as filters change.
  - `GET /web/products/:slug`: product, its packs at the store (empty if the store doesn't sell it), breadcrumbs trail, related products, and its `brand` (name, logo, theme colour, link): the product's brand, or the store for a staple it packs itself, as in the app. The page shows it as a logo chip above the name that opens the brand's store (`components/brand-promo.tsx`). Any product some live store sells has a page.
  - `GET /web/search?q=&sub=&tag=&size=&exact=1` plus the category filters (`brand= price= off= rating= offers=1 food= stock=1 sort=`): the app's search (`searchStoreProducts`: store brand boost, sponsored slots, spelling fix) picks and ranks the results for the tab and pack size, then `rankedList` runs them through the category filters in that order, so search has the same Amazon-style sidebar, facet counts, sheet and chips (`services/web-shop/search.ts`). Up to 200 results on one page. A size filter narrows each card to that pack; a brand filter or another sort drops the ads, as in the app. The store's own-brand chip from the app's search isn't a web filter: its products filter under their real brand.
  - `GET /web/search/suggest?q=`: the app's typeahead (`suggestSearches`), sponsored rows carry `adBannerId`.
  - `GET /web/search/landing`: the app's search landing for a guest (`buildSearchLanding`): trending, occasion spotlights, time-of-day picks, popular categories.
  - `POST /web/search/log` and `/web/search/event`: web searches and result taps, logged like the app's (`services/search-log.ts`, shared with `/search/log`). Only the site may call them: it sends `x-martly-web-secret` (`WEB_API_SECRET`) and `x-martly-visitor` (a hash of the shopper's IP), and the rate limit counts each visitor. Without `WEB_API_SECRET` set they work outside production only.
  - `GET /web/sitemap`: departments, categories, product slugs sold by a live store; collections and brands a visitor with no store (a crawler) can open at the store they are given.
  - Shop endpoints cache 60s, home/store 300s, sitemap 1h.
- **Product slugs:** `products.slug`, unique, made from the name by a database trigger on insert and never changed after (migration `20261026160000_product_slugs`). Repeated names get `-2`, `-3`.
- **Home:** the same sections the team sets up in Manage → Home, drawn for the web (`services/web-shop/home-sections.ts`, `home-system.ts`; renderers in `src/components/home/`).
  - The API maps each section to a web shape (`WebHomeSection` in `packages/shared/src/types/web-home.ts`): listings become `WebProductCard`s with all their packs, and every tap target becomes a site path (`services/web-shop/links.ts`: collections, festival tiles, aisles, categories, brands, banners by action type, offer pages).
  - Left out on the web (need an account or an app-only feature): MEMBER_CHIPS, PLUS_PROMO, MONTHLY_LIST, BUY_AGAIN, OFFERS (coupons), RECENTLY_VIEWED, STORE_WALK, RECIPES, STORE_POSTS. FESTIVE_HERO and BUY_GET_DEALS drop when the hero cards already carry them (`withoutHeroDuplicates` in `@martly/shared/home`, the app's rule).
  - The first two pages come with the HTML; the rest load as the shopper scrolls (IntersectionObserver, `getHomeSections`). The tabbed row's other tabs load from `/web/collections/:slug`, price bands and their category chips from `/web/deals/:sectionId`, in place.
  - Festival headlines use the festival's typeface (Playfair Display, Yatra One, Kalam, Lobster from Google Fonts).
- **Ranking:** shelves and category lists put products more stores stock first, then by name (a stand-in for popularity until there are enough orders).
- **Pages**
  - `/`: the store's header (`components/home/store-banner.tsx`): a band in the store's brand colour (Martly teal when it has none; dark text on light colours), its logo on a white plate, its name as the h1 with its tagline or "Groceries online in {town}", address, and its offer line (else live deals), rating and free-delivery threshold from `profile` on the first `/web/home-sections` page. On wide screens its right side holds a delivery card (open now / closed with hours, "Delivery in N min" while express is open, the next bookable slot; `profile.delivery`, IST) and, from 1280px, an app card (Play Store QR and button; the app can't open on a given store from a link yet). Under it, the Home's HERO_BANNERS section moves up as a carousel (`components/home/hero-carousel.tsx`: one slide with the next peeking on phones, two on tablets, three on desktop, turns every 5s, pauses on hover/focus, dots and arrows; views and taps count through `/banners/events`). It moves only when it is on the first two pages (it is in the default layout); otherwise it stays in place. Then the Home sections, stores in the town, app band, FAQ.
  - Store cover banners are ordinary store-scoped HERO_CAROUSEL banners, so the same ones show on the app's Home and on the store's card in the app's store selector. `apps/api/scripts/store-cover-banners.ts` paints a set (English + Tamil, proofread) and adds it; Sree Ranga's set was made with it.
  - `/collections/{slug}` (`?aisle=`, `?tile=`, `?page=`), `/brands/{slug}`, `/offers/buy-get` (`?category=`), `/best-sellers`, `/deals/{sectionId}` (`?band=`, `?category=`; noindex, since sections come and go).
  - `/c/{department}`, `/c/{department}/{category}` (`?sub=`, `?page=`, plus the filters above). Wide screens get a sticky left rail (Category, Brand with See all and a find box, Price bands + min–max, Discount, Offers, Customer rating, Food type, Availability; each group only when it has something to pick). Below `lg`, a Filters pill opens the same groups as a sheet; each pick applies at once and "Show N products" closes it. Above the grid: the count, Sort, and the filters in use as removable chips with Clear all. A filtered or sorted view is noindex. `/brands/{slug}` uses the same view (`components/category/filtered-list.tsx`) with the subcategory chips on top at every width and no Category or Brand group in the rail.
  - `/p/{slug}`: laid out like an Amazon listing. Gallery beside the buy box (pack sizes with prices, ADD) and "About this item" (the description as points). Below them: "Product information" (brand, category, diet, packs, shelf life, storage, allergens, manufacturer, FSSAI, origin) beside "Nutrition facts" (its "per 100 g" basis as a caption), then "Important information" (ingredients, directions, storage, allergens, safety, legal disclaimer). The API builds these sections in `services/web-shop/product-info.ts`. Then related products.
  - `/search` (noindex): with no `q`, the landing (recent searches kept in the browser like the app keeps them on the phone, trending, spotlights, time picks, categories); with `q`, results with the app's tab row, Filters (brand + food type), Brand, Sort, Size and Offers, a brand row, and "Showing results for … · Search instead for …". Every filter is in the URL and changes in place.
  - `/for-stores`: the store-owner pitch (hero, facts, how it works, app screenshots, contact).
  - `/{town}`: "Grocery stores in {town}", loaded from `GET /web/towns/:town` (`services/web-shop/town-page.ts`).
    - The page opens with town facts: the number of stores, the fastest delivery, and how many are open now.
    - Each store gets a shopfront card (`components/town/store-card.tsx`) showing:
      - its cover, which is its first live Home cover banner, else its photo, else its brand colour;
      - its logo, size, open or closed state with hours, and address;
      - delivery time or the next slot, product count, deals, free delivery and rating.
    - The page also has "How ordering works" and an ItemList + breadcrumb JSON-LD. It is in the sitemap.
    - An unknown town shows "Martly isn't in this town yet" (404).
  - `/{town}/{store}`: the store's own address, which is also the link it shares. It renders the same Home as `/` (`components/home/home-page.tsx`, loaded by `lib/home-page.ts`), but for the store in the URL. Visiting it also makes that store the shopper's. It has its own title, description, canonical URL and GroceryStore + breadcrumb JSON-LD, and it is in the sitemap, so each store can be found by its name. An unknown store shows "We couldn't find that store" (404).
  - `/robots.txt`, `/sitemap.xml`, 404 for anything else.
- **Department bar** (`components/department-bar.tsx`): under the header on every page with a store except Home (Home has its department tiles), one sideways-scrolling row of the store's departments with their pictures; on `/c/{department}…` that department is filled and scrolled into view. It scrolls away with the page.
- **Product cards** show the pack picker, `% OFF` and a "Buy X Get Y" badge from the pack's offer.
- **Header search:** the app's typeahead as you type (200ms pause): recent matches first, pictures, the typed part plain and the rest bold, ↖ to keep refining, "Ad" rows; ↑/↓/Enter/Esc. Empty and focused, it lists recent searches.
- **Search analytics:** a results page logs its query once (and saves it to recents when it found something); opening or adding a result logs CLICK/ADD_TO_CART with its position. Sponsored results show "Ad" and count views (batched) and taps (sent at once) against their banner via `/banners/events`.
- **URLs:** the router reads and writes plain query strings (`src/router.tsx`), so `?q=500` stays text.
- **ADD:** opens the "Order on the Martly app" sheet (Play Store link, QR code on desktop at `public/brand/play-qr.svg`). There is no web cart yet.
- **SEO:** title, description, canonical and Open Graph tags per page (`pageHead` in `src/lib/seo.ts`). JSON-LD: home (Organization, WebSite, stores, FAQ), store pages (GroceryStore + BreadcrumbList), departments/categories (BreadcrumbList), products (Product + AggregateOffer at the shown store + BreadcrumbList). `SITE_URL` is fixed to `https://martlyshop.in`.

## Run it

```bash
pnpm --filter @martly/web dev     # http://localhost:7002, reads the API at MARTLY_API_URL (default http://localhost:7001/api/v1)
pnpm --filter @martly/web build && PORT=7002 node apps/web/server.prod.js
```

## App screenshots

The spotlight rows and the hero phone stack use `apps/web/public/screenshots/*.webp` (640×1387, iPhone ratio). File names are referenced in `src/lib/content.ts` (spotlights) and `src/components/hero.tsx` (hero stack). Replace the files to update them. The current set comes from quartex.in and shows older demo stores.

## Tested

- Shop endpoints via curl: home shelves, department, category paging and bad `sub`, search, product (and 404), sitemap; a bad `store` cookie falls back to the default store; a product priced at Kaveri Fresh differs from Sree Ranga.
- Every product got a unique slug (19,981 local; the same backfill gives unique slugs on prod, checked read-only); inserting a product with no slug gets `name-2` when the name exists.
- Playwright, iPhone 13: switching store in the header picker sets the cookie and reprices the product page (₹42 → ₹40); ADD opens the app sheet; no horizontal scroll on `/`, category, product, search, `/for-stores`, store page.
- Production build: SSR HTML of `/p/...` has the canonical link and Product/AggregateOffer/BreadcrumbList JSON-LD.
- Home sections (Sree Ranga, local): `/web/home-sections` lists the app's section types in the app's order, minus the left-out ones (HERO_CARDS, BESTSELLER_CATEGORIES, DEPARTMENT_GRID, HERO_BANNERS, PRODUCT_ROW ×5, TABBED_ROW, THEME_BAND ×3, PRICE_BAND_DEALS, STORE_GRID, BRAND_RAIL, BRAND_POSTERS, BRAND_CARD ×2, TIME_PICKS, EXPLORE_GRID, BUY_GET_DEALS, CAMPAIGN_CARD). Every one of the 89 links in them returns 200 on the site; unknown collection and brand slugs return 404.
- Home SSR HTML has the title, h1, JSON-LD (built in the loader from the root's towns) and the first 11 sections; scrolling loads the rest (25 in all). No hydration errors.
- Playwright, 1440px and iPhone 13: no horizontal scroll on Home, collection (festival tile and aisle filters), brand, deals band, buy-get pages; the tabbed row switches tabs, the price band switches bands and category chips in place; ADD opens the app sheet.
- The app's `/home/:storeId/deals` and `/brands/store/:storeId` answer as before after their queries moved to services.
- Sitemap: 12,757 URLs, with 21 collections and 656 brands.

- `/`, `/dharmapuri/sreerangastore`, `/robots.txt`, `/sitemap.xml` return 200; unknown store and unknown path return 404.
- Server HTML contains the h1, canonical link and the JSON-LD graph.
- Rendered at 1440px and on iPhone 13 emulation: no horizontal scroll.
- Production build + `server.prod.js` serve pages, screenshots and favicon.

- Search (Sree Ranga, local): for oil, detergent, milk, detergant and amul, `/web/search` returns the app's `/stores/:id/products?q=` order and facet counts; sub, brand, size, food, offers and all three sorts match the app; `exact=1` skips the correction; suggestions match the app's.
- Playwright, 1440px and iPhone 13: typeahead (rows, ↖ fill, ↓ highlight, Esc), Enter to results; tab, then sort, then Filters → brand keep each other in the URL (6 KLF coconut oils); the spelling banner and "Search instead for" (`exact=1`); recents show on `/search` after a reload; the filter sheet is a bottom sheet on phones; no horizontal scroll, no console errors.
- Logging: web searches write `search_logs` (no user); a result open writes CLICK at position 0, an ADD writes ADD_TO_CART at its position; the "chips" ad shows "Ad" and its view and tap each add one to `banner_stats_daily`. Without the visitor header the log answers 403.
- Production build + `server.prod.js`: landing, filtered results and the spelling banner render; the client bundle has no secret or hashing code.

- Category filters (2026-10-27, local, Sree Ranga's Bread with seeded discounts, a BOGO and reviews): curl each filter alone and combined (bands add up, each group's counts ignore only its own filter, `off=25` cards all ≥25%, price sort in order, a picked brand left at 0 stays listed). Playwright at 1440, 1100, 800 and iPhone 13: brand ticks, % off, chip remove, Clear all, min–max Go, sort, Pager keeps filters, phone sheet stays open across picks, noindex on filtered views, no horizontal scroll or console errors.

- Department bar (2026-10-27, local): `/web/departments` lists Sree Ranga's 16 departments and each answers 200. Playwright at 1440, 700, iPhone 13 and 320: the bar shows on department, category, brand and search pages with the right one current, not on `/` or `/for-stores`; tapping Dairy opens `/c/dairy`; no horizontal scroll or console errors.

## Needs manual verification

- Header picker on a real phone: "Use my location" inside and outside a delivery area.
- Home next to the app's Home on the phone, section by section (device screenshots need `sudo pymobiledevice3 remote tunneld`).
- Best sellers and the "Most bought" hero card: no local orders, so the list is empty and the card doesn't show.
- STORE_SPECIALS, CATEGORY_DIRECTORY, FESTIVE_HERO (without hero cards) and DEALS sections: built, but the local Home doesn't use them.
- Home render time: about 1.1s locally, mostly the app's own section resolvers (~0.4s a page, and the second page waits for the first's cursor).
- New app screenshots in place of the quartex.in ones.
- Deploy target and DNS for martlyshop.in, and `MARTLY_API_URL` pointing at the prod API there.
- `WEB_API_SECRET`: set the same value on the Railway API and on the web service, or web search logging is refused in production. The site also sends the visitor headers on `/web/search`, `/web/search/suggest` and `POST /banners/events`, whose rate limits count per visitor; without the secret every web shopper shares the site server's one limit.
- Search logging behind the real proxy: the visitor hash reads `X-Forwarded-For`; check it differs per shopper once deployed.
- Tamil version of the site (not built yet).
