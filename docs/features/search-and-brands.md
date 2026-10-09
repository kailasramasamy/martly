# Search results, attribute tags, Shop by brands, voice search

Blinkit-style product discovery on mobile: tag tabs, filter/sort controls, a 3-column result grid,
a "Shop by brands" strip in listings, and voice search.

## Flow

### Text search (`app/search.tsx`, `lib/use-product-search.ts`)
1. User types (300 ms debounce) or speaks a query.
2. With a store selected, the app calls `GET /api/v1/stores/:id/products?q=…` with `tag`, `brandIds`,
   `size`, `foodType`, `hasDiscount`, `sortBy` (`relevance` | `price_asc` | `price_desc` | `discount`,
   from `SearchSortBy` in `@martly/shared/constants`). Query validated by `storeProductSearchQuerySchema`.
3. API (`services/store-search.ts`) returns the whole ranked match set (no paging) plus `facets`:
   - `tags` — top 8 attribute tags over all matches (ignores other filters, so the tab row is stable)
   - `brands` (with logo or pack-shot `imageUrl`), `sizes`, `offerCount` — over matches in the selected tag
4. App shows tag tabs, the Filters / Sort / Quantity / Offers bar, sheets, and a 3-column compact grid.
   Deep links (category, deals, new arrivals) still use the paged 2-column browse mode.

### Search ranking (`services/search.ts` keywordSearch)
Name matches are tiered: whole word → word start → substring → translated name → description.
When ≥3 whole-word name hits exist only those are returned ("dal" no longer returns Dalda or
"butter for dals"); otherwise looser tiers are used. Price sort uses the effective (discounted) price.

### Attribute tags
- `Product.tags` (lowercase, e.g. `organic`, `unpolished`, `sugar-free`), GIN-indexed
  (`migrations/20261009000000_product_tags_gin`). Editable in admin product edit → General → Tags.
- Backfill: `cd apps/api && npx tsx scripts/backfill-product-tags.ts [--dry-run] [--limit N] [--force]`
  (Claude Haiku; only tags explicitly stated in name/description; skips tagged products unless `--force`).

### Shop by brands (`components/ShopByBrands.tsx`, `lib/brand-strip.ts`)
- Category listing, store products and search results show a full-width strip after the 2nd product row.
- Tiles: top 10 brands by product count; image = brand logo (admin Brands → Edit) else the brand's
  most-reviewed product image. Hidden when < 3 brands.
- Tap filters the listing to that brand (search: sets the brand filter); tap again clears it.

### Voice search (`lib/use-voice-input.ts`)
- Mic in the search box: interim transcript shows live, the final transcript runs the search; tap to stop.
- Home search-bar mic opens search and starts listening (`/search?voice=1`), no longer Martly AI.
- Hidden when native speech recognition is unavailable (Expo Go).

## Tested
- curl: `q=toor dal` (12 products, tabs organic/unpolished/premium/pesticide-free), `dal`, `atta`,
  `paneer`, `amu`, `tur`, `price_asc` ordering by effective price, `hasDiscount`, invalid `sortBy` → 400,
  brand facet images, browse (no `q`) unchanged and paged.
- Device: search results screen with tag tabs, control bar and 3-column cards (toor dal).

## Needs manual verification
- Filters / Sort / Quantity sheets, Offers toggle and tag switching on device.
- Voice search on device (mic permission prompt, en-IN recognition, stop button).
- Shop by brands strip on category, store and search screens; brand chip clear.
- Seeded toor dal products share one stock photo — replace with real pack shots.
