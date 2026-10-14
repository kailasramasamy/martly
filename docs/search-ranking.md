# Search Ranking & Subcategory Tabs

## Flow

`GET /api/v1/stores/:id/products?q=...` → `searchStoreProducts` (`apps/api/src/services/store-search.ts`) → `searchProducts` (`apps/api/src/services/search.ts`).

Every strategy only considers products the store actively stocks, so no stocked product can be cut by a limit before the store filter runs.

1. **Keyword** (up to 200 results). Ordering:
   - **Intent band first**: products in a subcategory whose `searchTerms` contain the whole query ("shaving" → Razor & Blades, Shaving Cream & Gel). These products rank even when the query isn't in their name.
   - **Name tier**: whole word → word start → substring → translated name → description. Product names are matched **without their leading brand**, so "Bombay **Shaving** Company Beard Oil" no longer matches "shaving". A query that names the brand ("surf", "surf excel liquid") matches name + brand instead.
   - **Taxonomy**: category name matches the query ("oil" → Edible Oils) → subcategory matches (Hair Oil) → name only (Body Lotion with Almond Oil).
   - **Weighted brand turns**: a brand's n-th product scores `n × (120 − popularity)`. A 100-popularity leader gets a slot every 20 points and a 50-popularity brand every 70, so leaders lead without filling the page. Intent-only products (aisle match, no name match) get a +40 penalty, so "razor" shows razors before the aisle's shaving brushes.
   - **Store best-sellers** (non-cancelled order items), then name.
2. **Trigram fuzzy**, then **full-text**, then **Claude Haiku semantic expansion**: these run only when fewer than 3 results are found. They are unchanged apart from store scoping.

## Ranking signals

| Signal | Where | Source |
|---|---|---|
| `Subcategory.searchTerms` | Words shoppers type for an aisle, including Hindi/Tamil transliterations ("dadhi", "sabun") | `prisma/data/subcategory-search-terms.json` |
| `Brand.popularity` (0–100) | Recognition in India; the tie-breaker that puts Gillette before Bombay Shaving Company | `prisma/data/brand-popularity.json` |

- `prisma/generate-search-intents.ts` asks Claude Opus 5.5 (structured output, with server-side refusal fallback) to fill **only the keys missing** from the JSON files. Hand edits survive a re-run, and new subcategories or brands get covered.
- `prisma/seed-search-intents.ts` loads the JSON into the DB (by slug, in one transaction). Re-run it after editing the JSON.
- Admins can edit both: the brand edit form has **Popularity**, and the subcategory edit form has **Search terms** (tags).
- Generic words (oil, dal, detergent) are deliberately left out of aisle terms. Name matching handles them. "milk" was added by hand to the toned, double-toned and full-cream milk aisles.

## Typeahead (`GET /search/suggest`)

- Category rows also match aisles whose search terms start with the typed text ("shav" → Razor & Blades).
- Brand rows are ordered by `popularity × ln(1 + matching products)`, so a leader with one stray hit ("Cadbury chips") stays out. Matching uses the brand-less name, so a brand isn't suggested just because its name contains the word.
- Brand expansion into "<Brand> <subcategory>" rows only happens when the query names the brand ("gillette" → Gillette Razor & Blades), not when the word sits inside the brand name ("shaving").
- The spell-check word list includes aisle search terms.

## Search event logging (training data for learning-to-rank)

- `POST /search/log` now returns `{ id }`.
- `POST /search/event { searchLogId, productId, type: CLICK | ADD_TO_CART, position }` writes one `search_events` row per search, product and type (re-taps are ignored). Signed-in users can only log events against their own searches.
- Mobile search results call it when a result card opens the product page or adds to cart (including from the size sheet). `position` is the product's 0-based place in the results.
- Not yet used for ranking: once there's volume, rerank by add-to-cart rate per (query, product). Adds made on the product page after a click are not attributed.

## Tab row (mobile search)

- Facets now include `subcategories` (max 10), in relevance order, with the image of the top-ranked product in each.
- If matches span 2+ subcategories, the tab row shows subcategory chips ("Sunflower Oil", "Groundnut Oil"…) and filters with `subcategoryId`. Otherwise it falls back to the product-tag chips (`tag`).
- Tab facets ignore other filters, so the row stays stable when a tab is selected.

## Tested (curl, Harur Fresh Mart: full catalog, 2026-10-14)

Snapshot of the top 10 results and suggestions for 25 queries, before and after:

- `shaving`: Gillette is first (it was Axe and then Bombay Shaving Company, alphabetical). 98 → 125 results, now including razors and blades. Suggestions: Shaving Cream & Gel, **Razor & Blades**, After Shave, Gillette shaving. The Bombay Shaving Company "Bathing Soap" and "Beard Oil" rows are gone.
- `razor`: Gillette razors are first. `shave` / `beard` / `after shave` are sensible.
- `milk`: fresh milk (Amul, Mother Dairy, Nandini) leads instead of flavoured milk and milkshakes.
- `oil`, `dal`, `detergent`, `soap`, `toothpaste`, `chips`, `tea`, `coffee`, `rice`: market leaders lead (Parachute and Fortune, Surf Excel, Lifebuoy, Colgate, Lay's…) instead of an alphabetical "24 Mantra / Axe / Bertolli" start.
- Brand queries (`gillette`, `surf excel`, `maggi`) are unchanged.
- `shavng` corrects to shaving with the same results.
- Latency: the keyword query is about 250ms (about 170ms before). Brand names are cleaned once per brand and the match step is `MATERIALIZED`. End to end, the endpoints take 0.3–0.43s, the same as before.
- `/search/event`: 201 on CLICK and ADD_TO_CART, a duplicate is ignored, an unknown product gets 404, an invalid type gets 400.
- Admin: `PUT /brands/:id {popularity}` (101 → 400), and `PUT /categories/subcategories/:id {searchTerms}` trims and lowercases.

## Known gaps

- Typos like `sunflwer` fall through to semantic expansion: trigram similarity is about 0.58, under the 0.6 threshold.
- Multi-word intent queries (`healthy breakfast`) stop at weak description-only keyword hits and never reach semantic expansion.

## Manual verification

- Search "shaving" on the device: Gillette first, Razor & Blades in suggestions.
- Tap a result and add one to cart, then check `search_events` has a CLICK and an ADD_TO_CART row with positions.
- Review `prisma/data/subcategory-search-terms.json` for wrong mappings (e.g. "dadhi" also maps to curd), then re-seed.

- Search "oil" on the device. Check the subcategory chips, the chip filter, and the brand strip.
- Search a single-subcategory term (e.g. "sunflower oil"). The row falls back to tag chips, and is hidden when there are fewer than 2 tags (currently true for "sunflower oil").
