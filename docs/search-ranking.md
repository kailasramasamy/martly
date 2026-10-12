# Search Ranking & Subcategory Tabs

## Flow

`GET /api/v1/stores/:id/products?q=...` → `searchStoreProducts` (`apps/api/src/services/store-search.ts`) → `searchProducts` (`apps/api/src/services/search.ts`).

Every strategy only considers products the store actively stocks, so no stocked product can be cut by a limit before the store filter runs.

1. **Keyword** (up to 200 results). Ordering:
   - **Name tier**: whole word → word start → substring → translated name → description.
   - **Taxonomy**: category name matches the query ("oil" → Edible Oils) → subcategory matches (Hair Oil) → name only (Body Lotion with Almond Oil).
   - **Brand round-robin**: each brand's top product before any brand's second, so one brand can't fill the first rows.
   - **Store best-sellers** (non-cancelled order items), then name.
2. **Trigram fuzzy**, then **full-text**, then **Claude Haiku semantic expansion**: these run only when fewer than 3 results are found. They are unchanged apart from store scoping.

## Tab row (mobile search)

- Facets now include `subcategories` (max 10), in relevance order, with the image of the top-ranked product in each.
- If matches span 2+ subcategories, the tab row shows subcategory chips ("Sunflower Oil", "Groundnut Oil"…) and filters with `subcategoryId`. Otherwise it falls back to the product-tag chips (`tag`).
- Tab facets ignore other filters, so the row stays stable when a tab is selected.

## Tested (curl, Downtown Mart)

- `oil`: 161 products (previously capped at 50, alphabetically, catalog-wide, cutting off Fortune and Gold Winner). Edible oils come first, one per brand; personal care comes last. Ten edible-oil subcategory tabs.
- `atta`, `dal`, `rice`, `fortune`: relevant first, sensible subcategory tabs.
- `subcategoryId` filter narrows correctly; an invalid UUID returns 400.
- Response time for `oil` is about 0.13s.

## Known gaps

- Typos like `sunflwer` fall through to semantic expansion: trigram similarity is about 0.58, under the 0.6 threshold.
- Multi-word intent queries (`healthy breakfast`) stop at weak description-only keyword hits and never reach semantic expansion.

## Manual verification

- Search "oil" on the device. Check the subcategory chips, the chip filter, and the brand strip.
- Search a single-subcategory term (e.g. "sunflower oil"). The row falls back to tag chips, and is hidden when there are fewer than 2 tags (currently true for "sunflower oil").
