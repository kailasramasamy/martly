# Walk the store

A guided pass through the store's aisles in shelf order, like strolling the shop. Each aisle shows the shopper's due
items, then the aisle's best sellers, and "Next aisle" moves on. It's the first feature from
[store-experience-plan.md](store-experience-plan.md). Mockups: https://claude.ai/artifact/L7oAEtqGsnBKMinAcJcLxW

## Flow

1. **Entry points**
   - **Home:** the `STORE_WALK` section, a teal card right after Buy again. It shows items due, the starting
     department's aisle count and an estimated time. The hero cards carousel is unchanged.
   - **Cart:** a "Missed anything?" card below the lines. It shows when the starting department has at least 2 aisles the
     cart has nothing from, and opens the walk with `from=cart`.
   - **Checkout:** a slim amber row above Place order, shown when usual items are missing from the bag. "Add all ₹X"
     adds up to 3 of them in the size the shopper buys, and "Or take a quick walk" opens the walk with `from=checkout`.
   - A dismissed nudge stays hidden for the app session. Neither nudge shows after the shopper has walked an aisle in
     that session (`lib/walk-session.ts`).
2. **Pick a department** (Home entry only): department chips with due badges, and the chosen department's aisles in
   shelf order. From the cart or checkout, the walk goes straight to the aisles and skips any aisle the cart already
   covers, unless an item there is due.
3. **Aisles:** the aisle's board (its photo and name) hangs in front of a photo of a local supermarket aisle
   (`assets/images/store-walk/aisle-wall.webp`, generated with gpt-image-2.5-flare at medium quality and bundled in the app).
   The previous and next aisles hang grey at the edges; tap one, or swipe the wall, to move.
   - "Running low?" shows the due items as a product rail.
   - Subcategory tiles follow ("All" first). A tile loads that subcategory's 15 best sellers in place.
   - Brand chips follow: the store's own brand first (its brands and the staples it packs, under its logo, id
     `own-<storeId>`), then the brands on these shelves (the picked subcategory's), best sellers first. One tap shows
     only that brand (15 best sellers), a second tap clears it; picking a subcategory clears the brand.
   - "Popular in this aisle" shows five shelves (15 products). The store's own brand leads with its best 6 (two
     shelves at most, so the aisle's other brands still show), then the rest by brand popularity in the
     store's region (30-day units and stock break ties, so a new store's few orders don't outrank known brands),
     spread over the subcategories. Brand chips after the store's own follow the same popularity.
   - **Search the shelves:** the magnifier on the "Popular in this aisle" row (or the picked subcategory's name) opens
     a field in that row, "Search in ‹aisle · brand›". Typing pauses for 300 ms, then the shelves show only matches
     within what's on show: the aisle, the picked subcategory and the picked brand. Picking a subcategory keeps the
     words. No matches offers "Search the whole store"; ✕ clears it and the best sellers come back.
   - The products stand on wooden shelves, three to a shelf, in white shelf units (the catalog photos have white
     backgrounds, multiplied onto the wood; a store's pack render, cut tight, stands as it is). Each pack has a round +
     resting on the plank under it, clear of the photo (a − n + pill once added; several sizes open the size picker). Its price, MRP, deal, name and size are on a paper sticker taped to the shelf's front edge, each a little
     askew. Tapping a pack opens its product page.
   - "See all N" opens the category, or the picked subcategory.
   - Prices on the stickers are handwritten (Kalam). The floor is a pale tiled pattern.
   - **End of aisle offers:** after "See all", a red board over one shelf of up to 3 running offers from elsewhere in the
     department (buy X get Y first, then the biggest saving; store discounts or multi-buys only, never a plain MRP
     saving). It hides with fewer than 2.
   - **Department photos:** each department has its own aisle photo behind the signs (`departments.aisle_image_url`,
     made by `prisma/generate-aisle-walls.ts` with gpt-image-2.5-flare at medium quality and served from the CDN). The
     bundled grocery photo shows while one loads, and for a department without one.
   The bottom bar shows the bag total (tap for the cart), "See my bag" (ends the walk at the summary) and "Next aisle" with the next aisle's photo and name (15 pt, up to two lines). The Map button opens the aisle map: walked,
   here, ahead; tap an aisle to jump to it.
4. **Department done:** a check mark, then the next department to walk (the one with most due items, else the next on
   the shelves) and up to 3 others, or "I'm done".
5. **Summary:** a paper bag (`assets/images/store-walk/paper-bag.webp`, drawn twice so up to 4 of the walk's own packs
   stand inside it) with the done mark, beside the aisles walked and minutes, the bag total and items added. The aisle
   the shopper is in when they finish, or jump away from on the map, counts as walked. The lines this walk added follow,
   grouped under the aisle each went in from (recorded when it went in the bag). Tapping a line opens the product; − and
   + change it, and the bin at 1 takes it out with Undo on the toast. Then the cart's suggestions and "Go to cart".

## How it's picked (`apps/api/src/services/store-walk.ts`)

- **Aisles** are the categories with stock at the store (available = stock − reserved > 0), in department then category
  `sortOrder`.
- **Due items** use `dueInStock()` in `services/reorder.ts`, the same rule cart review's "Did you forget?" uses:
  - restockable subcategories only
  - status due or overdue
  - bought at least twice, over 7+ days
  - in stock, in the size the shopper buys
- **Starting department:** the one asked for, else the one with most due items not in the cart, else the one most
  shoppers bought from in 90 days (then orders, then aisle count). That makes Grocery & Staples the default at Harur Fresh
  Mart without naming it.
- **Popular in an aisle:** up to 8 in-stock products, each as its best-stocked size, ranked by 30-day units, then brand
  popularity, then stock. Due items are left out. At most 2 come from one subcategory, unless the aisle is too small to
  fill the shelf otherwise.
- **Searched in an aisle (`q`):** the store's keyword search (no meaning-based expansion), kept to listed products in
  the aisle, subcategory and brand. Each matching product shows once, as its best-stocked in-stock size, in search rank
  order, up to 24 (from the top 60 matches). Due items aren't pulled out. A blank `q` is no search.

## API

| Endpoint | Auth | Body / reply |
|---|---|---|
| `POST /api/v1/store-walk/:storeId/route` | optional | `{ departmentId?, cartStoreProductIds? }` → `{ departmentId, departments[], stops[] (with dueCount, inCart), cartAisles, uncovered, uncoveredDue, due[] }` |
| `GET /api/v1/store-walk/:storeId/aisles/:categoryId` | optional | `?subcategoryId&brandId&q` → `{ category, stocked, due[], popular[] }` |

- The route is a POST because the cart lives on the phone.
- Guests get no due items.
- Both endpoints return 404 for a store that isn't ACTIVE, 400 for a bad id, and 404 for an aisle with no stock.

The Home section came in through two migrations: `20261025120000_store_walk_section` adds the enum value, and
`20261025120100_store_walk_home_section` places the section after Buy again in saved layouts. Admins can move it or
switch it off in Home layout.

## Animations (React Native `Animated`; no new native library, so it ships over the air)

| Where | What happens |
|---|---|
| Aisle sign | Drops in and swings to rest (spring on `rotate`, origin at the top) |
| Next aisle | The aisle slides out left, the next slides in from the right |
| Progress | One segment per aisle; the current one fills (`scaleX`) |
| Due block | Two soft amber glows when the aisle opens |
| Bag | A wire basket with the walk's last 3 packs over its rim; it bounces when the total goes up, a "+₹N" chip floats up and the total counts up |
| Adding from a shelf | The pack's photo is tossed into the basket (a small rise, then a fall, shrinking and turning) |
| Packs to scale | A pack stands at 50% (50 g or less) to 100% (10 kg or more) of the shelf height, on a log scale; counted items at 80% |
| Depth | The aisle photo moves at 40% of the aisle's slide, so it reads as further off |
| Low stock | With 5 or fewer left, the sticker says "Only N left". Photos are multiplied onto the white shelf so a white background drops away |
| Offer flags | A red flag sticks out from the shelf for a buy-X-get-Y or a saving of 20% or more |
| Route, summary, nudges | Rows and chips fade and rise in one after another; check marks pop |

All of them jump straight to the end when the phone's Reduce Motion setting is on (`components/store-walk/motion.ts`).

## Tested

- API with curl at Harur Fresh Mart:
  - A guest starts in Grocery & Staples with 11 aisles and no due items.
  - The review OTP user starts in Grocery & Staples: 7 due items, and Grocery ties with Dairy on due items and wins on
    shoppers. Atta & Flours and Ghee carry the due badges.
  - With atta and a rice in `cartStoreProductIds`, those aisles come back `inCart`, the atta drops out of the due items,
    and the route moves to Dairy (2 due).
  - The Atta & Flours aisle: the due Pillsbury Chakki Fresh Atta 5 kg, then 8 popular items across maida, besan, rava,
    sattu and atta.
  - A bad store id and a bad cart id return 400. An unknown store and an unknown aisle return 404. An empty body is fine.
  - Searching the Ghee aisle: "amul" → 6, "amul" in Buffalo Ghee → 3, "பசு நெய்" → 24, "aavin" → 3, "pouch" with the
    Amul brand → 2, "soap" → 0, blank → the best sellers.
  - `/cart/review` returns the same 7 `forgotten` items after moving the due rule into `dueInStock`.
  - Home sections: `STORE_WALK` sits after `BUY_AGAIN` for guests and for signed-in shoppers (`aisleCount` 11, `dueCount` 7).
- The API, admin and the touched mobile files type-check. The mobile app's existing errors in other screens are unchanged.

## Needs checking on the phone

- The Home card, the department chips, an aisle with a due item, the sign swing and the slide.
- The bag bounce and "+₹" chip, the aisle map, the end-of-department card and the summary totals against the cart.
- The cart nudge, then a walk from it that skips covered aisles.
- The checkout row's "Add all", with the order total updating.
- Tamil: the strings and the bilingual aisle sign.
- The shelf search: open, type, pick a subcategory and a brand while searching, no matches, ✕.
- Reduce Motion on.
