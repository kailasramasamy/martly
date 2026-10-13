# Smart search landing

What the mobile search screen shows before the customer types. Previously the screen was empty.

## Flow

1. The search screen opens with the keyboard focused. If the query is empty and the screen wasn't opened from a deep link, it renders `SearchLanding` (`apps/mobile/components/search/landing/`).
2. `useSearchLanding` first paints the copy cached in AsyncStorage for this store, then refreshes it from `GET /api/v1/search/landing?storeId=` (optional auth).
3. Sections, top to bottom. A section is hidden when it has nothing to show.
   | Section | Source |
   |---|---|
   | Recent searches | Stored on the device (`lib/recent-searches.ts`): max 8, de-duplicated, each removable, plus Clear |
   | Trending near you | `search_logs` for this store over the last 7 days, ranked by distinct searchers. Topped up with the store's popular subcategory names when there are fewer than 8 |
   | Running low? / Buy again | `services/reorder.ts` predictions (overdue first). Logged-in users only |
   | Occasion / season spotlight | Active `Collection` rows with `kind` OCCASION or SEASON whose `startsAt`–`endsAt` window contains now. Festivals come before seasons; at most 2 are shown |
   | Time-of-day picks | `services/time-picks.ts` (IST): breakfast / afternoon snacks / dinner prep / late night |
   | Popular categories | Subcategories ranked by units sold at this store over the last 30 days, then by how many in-stock products the store has in them |
4. Tapping a chip runs the search immediately. Tapping a category opens the category listing.
5. **Search logging** (`lib/use-search-commit.ts`): a query is "committed" when the customer acts on its results. That means keyboard submit, scrolling the results, tapping a tab, or leaving the screen (for example opening a product). On commit, the query is posted to `POST /api/v1/search/log`. If it returned results, it's also added to recent searches. Half-typed queries are never logged.
6. The parts of the landing that are the same for every customer are cached in memory per store for 10 minutes. The reorder rail is computed per user on every request.

## Admin

Collections now have a **Kind** (Standard / Occasion / Season) and an optional **Schedule** (date range). The list shows Active now / Scheduled / Expired / Inactive. The home feed also hides collections outside their window.

## Schema

- `collections`: added `kind`, `starts_at` and `ends_at`. Migration: `20261013000000_search_landing`.
- `search_logs`: new table holding store, optional user, normalised query, result count and timestamp. Indexed on `(store_id, created_at)`.

## Seed

`cd apps/api && npx tsx prisma/seed-search-landing.ts` (safe to re-run):
- 6 scheduled collections: Diwali, Christmas/New Year, Pongal, Winter, Monsoon and Summer. Their products are ones Downtown Mart stocks.
- About 1.8k search logs spread over the past week across the org's active stores.
- 17 delivered orders for the `OTP_REVIEW_PHONE` login at Downtown Mart. Milk and curd come out overdue, detergent and atta due soon, and chips and ghee not yet due.

## Tested (curl, local)

- Guest landing returns trending, 12 categories, Diwali Specials + Monsoon Comforts, and the breakfast rail (IST morning). The reorder rail is empty.
- The review login's landing returns 4 due items with milk and curd first. `GET /smart-reorder` gives the same predictions after the refactor.
- `POST /search/log`:
  - 201 for both logged-in users and guests.
  - The query is lower-cased and repeated whitespace is collapsed.
  - 400 for a query over 100 characters or an invalid storeId.
  - 404 for an unknown store.
  - 429 after 30 logs per minute from one client.
- `tsc` passes for the API, the admin panel and the files changed in mobile.

## Needs manual verification

- How each section looks on a device: a guest on a fresh install, and the review login.
- Chip tap → results; clearing the query → landing comes back; removing one recent search and clearing them all.
- A query appears in Recent after submitting it or opening a product from its results.
- Admin: create a SEASON collection with past dates and confirm it is marked Expired and disappears from home and the landing.

---

# Typeahead suggestions & results polish

## Suggestions while typing
- **API:** `GET /api/v1/search/suggest?storeId=&q=` (`services/search-suggest.ts`), about 0.1–0.3 s per call.
- **The term itself.** The half-typed last word is completed from words in the store's catalogue ("deter" → "detergent"). If nothing in the store matches what was typed, it is spell-corrected word by word against that vocabulary (`services/spell.ts`), e.g. "deterget" → "detergent".
- **Rows, in order:**
  1. the term
  2. popular searches at this store that start with it
  3. matching subcategories
  4. brand suggestions:
     - for a product word, brand + word ("Surf Excel detergent")
     - for a brand name, the brand's own ranges ("Surf Excel Liquid Detergent")
- **Only stocked items.** Every suggestion has stock at the selected store; brand names drop the maker in brackets.
- **Mobile panel** (`components/search/SuggestionPanel.tsx`):
  - up to 2 matching recent searches with a 🕘 icon at the top
  - each row has a product thumbnail, and the words not yet typed are in bold
  - the ↖ button copies the suggestion into the search box to keep refining
  - the panel closes when you pick a row, press search, or the keyboard goes away
  - results keep loading underneath
- Requests use a 120 ms debounce, faster than the results' 300 ms. Responses are cached in memory and shared with the related chips.

## Spelling correction in search
- `searchProducts` now tries the spell-corrected query before trigram fuzzy matching. It returns `searchMeta.correctedQuery` as a real query ("detergent"), not a product name.
- Typos used to fall through to the slow AI expansion; they now resolve in about 0.3 s.
- `?exact=true` runs the words as typed. The mobile banner reads "Showing results for **detergent** · Search instead for <u>deterget</u>".

## Related-search chips
"→ Surf Excel detergent"-style chips sit under the filters (`RelatedSearches.tsx`). They come from the suggestions for the active query, minus anything already shown as a tab.

## Results polish
- **Short tab labels.** Search facets carry a `label`: the subcategory name minus the searched words. "detergent" gives Powder · Liquid · Bar, "oil" gives Groundnut · Olive · Sunflower. If the short labels would collide, the full names are used instead.
- **Brand pill** next to Filters. It opens the filter sheet narrowed to brands.
- **Unit price** on every card ("₹13.5/100 g", "₹27.5/100 ml"; `lib/unit-price.ts`). It's hidden for pieces and for exactly-100 g packs.
- **BESTSELLER badge.** A product gets it when it is among the store's top 20 by units over 30 days, with at least 3 units sold. The flag is `product.isBestseller` from `decorateStoreProducts` and is cached per store for 10 minutes.

## Tested (curl, local)
- **Suggestions:**
  - det / deter / deterget → detergent (corrected), its Bar / Powder / Liquid ranges, then Surf Excel / Patanjali / Ariel
  - "surf exc" → Surf Excel + 3 ranges
  - "basmathi" → basmati (corrected) + brands
  - "xyzq" → nothing
- **Typo searches:**
  - "deterget" → 36 results, corrected to "detergent"
  - "surf exel" → "surf excel"
  - "choclate" → "chocolate"
  - "basmathi rice" → "basmati rice"
  - `exact=true` → 0 results, as expected
- **Short labels:** checked across detergent, noodles, kaju, ghee, milk, oil and chocolate.
- **Unit price:** checked for g, kg, ml, L and multipacks (4x185g = 740 g).

## Needs manual verification (device)
- Suggestion panel: the bold completion, the ↖ fill button, recent rows, and the panel closing when the keyboard hides.
- The "Search instead for" link switches to exact results.
- Related chips, the Brand pill sheet, and how the BESTSELLER badge and unit price look on 2- and 3-column cards.
