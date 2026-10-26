# martlyshop.in (apps/web)

The public website. Shoppers land on a shop, not a pitch: they browse the products and prices of a store picked for them, the same way the app does (see docs/store-resolution.md). Ordering happens in the app for now; ordering on the web is Phase 3.

## How it works

- **Stack:** TanStack Start (React 19, server-rendered) + Tailwind 4, the same setup as quartex.in. Every page arrives as full HTML, so search engines read it without running JavaScript.
- **Data:** route loaders call server functions (`src/lib/api.ts`) that fetch the Martly API from the server, so the API needs no CORS entry for the site.
- **The shopper's store:** cookies `martly_store` (store id) and `martly_town` (town slug), httpOnly, one year. Server functions pass them to the API as `?store=&town=`. With no cookie (first visit, Googlebot) the API picks the default: the town's main store, else Martly's. The header chip ("Dharmapuri · from Sree Ranga Store") opens a picker: "Use my location" (browser geolocation → `/stores/resolve`) or a store per live town. Opening `/{town}/{store}` also makes that store the shopper's.
- **API** (`apps/api/src/routes/web/index.ts`, services in `services/web-shop/`), all public and returning only public fields:
  - `GET /web/home`: live towns and their stores, departments (root loader: header picker + footer).
  - `GET /web/stores/:town/:store`: one live store and its town.
  - `GET /web/home-sections?cursor=`: the app's Home sections at the store, a page at a time with the app's cursor (see "Home" below).
  - `GET /web/collections/:slug?aisle=&tile=&page=`: a collection or festival: title, art and theme (`campaignLook`, else the festival's hero theme), aisle chips, 24 products a page in the collection's order. Festivals use their own tiles as chips (`?tile=`); other collections group what the store stocks into aisles (`?aisle=` subcategory slugs, comma separated).
  - `GET /web/brands/:slug?page=`: a brand's products at the store; 404 when the store has none.
  - `GET /web/offers/buy-get?category=&page=`: every buy X get Y offer (`buyGetPage`), category chips by slug.
  - `GET /web/best-sellers`: the store's top 30 over 30 days (`mostBought`).
  - `GET /web/deals/:sectionId?band=&category=&page=`: a Home price-band section in full (`dealsSection` + `bandPage`, shared with the app's `/home/:storeId/deals`).
  - `GET /web/departments/:department` and `/:department/:category?sub=&page=`: a shelf per category; a category's products 24 a page, with subcategory chips and counts.
  - `GET /web/products/:slug`: product, its packs at the store (empty if the store doesn't sell it), breadcrumbs trail, related products. Any product some live store sells has a page.
  - `GET /web/search?q=&sub=&tag=&brand=&size=&food=&offers=1&sort=&exact=1`: the app's search (`searchStoreProducts`: store brand boost, sponsored slots, spelling fix), with its facets (tabs, brands, sizes, offer count) and the correction (`services/web-shop/search.ts`). Subcategories and brands go by slug; a size filter narrows each card to that pack.
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
  - `/`: a slim h1 ("{store}, {town}: groceries online"), the Home sections, stores in the town, app band, FAQ.
  - `/collections/{slug}` (`?aisle=`, `?tile=`, `?page=`), `/brands/{slug}`, `/offers/buy-get` (`?category=`), `/best-sellers`, `/deals/{sectionId}` (`?band=`, `?category=`; noindex, since sections come and go).
  - `/c/{department}`, `/c/{department}/{category}` (`?sub=`, `?page=`).
  - `/p/{slug}`: gallery, pack sizes with prices, ADD, description, details, related.
  - `/search` (noindex): with no `q`, the landing (recent searches kept in the browser like the app keeps them on the phone, trending, spotlights, time picks, categories); with `q`, results with the app's tab row, Filters (brand + food type), Brand, Sort, Size and Offers, a brand row, and "Showing results for … · Search instead for …". Every filter is in the URL and changes in place.
  - `/for-stores`: the store-owner pitch (hero, facts, how it works, app screenshots, contact).
  - `/{town}/{store}`: store landing page; sets the store and links to browse it.
  - `/robots.txt`, `/sitemap.xml`, 404 for anything else.
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

## Needs manual verification

- Header picker on a real phone: "Use my location" inside and outside a delivery area.
- Home next to the app's Home on the phone, section by section (device screenshots need `sudo pymobiledevice3 remote tunneld`).
- Best sellers and the "Most bought" hero card: no local orders, so the list is empty and the card doesn't show.
- STORE_SPECIALS, CATEGORY_DIRECTORY, FESTIVE_HERO (without hero cards) and DEALS sections: built, but the local Home doesn't use them.
- Home render time: about 1.1s locally, mostly the app's own section resolvers (~0.4s a page, and the second page waits for the first's cursor).
- New app screenshots in place of the quartex.in ones.
- Deploy target and DNS for martlyshop.in, and `MARTLY_API_URL` pointing at the prod API there.
- `WEB_API_SECRET`: set the same value on the Railway API and on the web service, or web search logging is refused in production.
- Search logging behind the real proxy: the visitor hash reads `X-Forwarded-For`; check it differs per shopper once deployed.
- Tamil version of the site (not built yet).
