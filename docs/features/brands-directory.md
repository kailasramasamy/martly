# Brands directory ("Shop by brand")

A customer screen listing every brand the selected store carries, grouped by department → category. Each brand opens its brand store (`/brand/[id]`).

## Flow
1. Home → "Shop by brands" rail → **See all** → `app/brands.tsx`.
2. The screen loads `GET /api/v1/brands/store/:storeId/directory` (public).
3. The layout, top to bottom:
   - A teal hero with the store name, brand and category counts, and a brand search.
   - A **Brand stores** carousel: brands with a theme colour, shown as full-colour gradient cards with their logo.
   - Sticky **department chips** (All + 16 departments), each in its department's colour.
   - Under "All", each department opens with a colour band, followed by its category sections.
   - Each category shows a 3-up grid of brand tiles, 9 at first, then **View N more**.
4. Brand tiles:
   - A brand with a logo shows it on a white plate, with a strip in the brand's colour ("STORE · N").
   - Other brands get a pastel "signboard" wordmark. The colours come from `wordmarkColors()`, the same as the home pills.
5. A search filters brand names across all categories and expands every match. It also hides the carousel.

## API
`GET /brands/store/:storeId/directory` → `BrandDirectory` (`packages/shared/src/types`):
- `departments[].categories[].brands[]`: active listings only. A brand appears under every category it has products in, and `productCount` is counted per category.
- Ordering: departments and categories by taxonomy `sortOrder`; brands with a theme colour come first, then by product count.
- `featured`: brands with a theme colour, with product counts summed across categories.
- `brandCount`: the number of distinct brands in the store.

`GET /brands/store/:storeId` (the home rail) also puts brands with a theme colour first now, so brand stores aren't pushed out of the top 12 by large generic brands.

## Tested
- Directory for Downtown Mart: 489 brands, 16 departments and 87 categories, matching a direct SQL count. There are 8 featured brands (MTR, Aachi, Sakthi, Everest, Eastern, Rasoi Magic, Wok N Roll, Idhayam), and Idhayam leads Edible Oils. An unknown store returns 404.
- The API and mobile files type-check.
- On the iPhone, the home rail shows the "See all" link.

## Manual verification
- Brands screen: hero, carousel scroll and snap, chips sticking under the status bar, and filtering by department.
- Search with no match shows the empty state; "View N more" expands a category.
- Tapping a tile or a featured card opens the brand store.
- Pull to refresh works.
