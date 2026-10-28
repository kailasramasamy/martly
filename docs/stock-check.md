# Stock check

Onboarding guesses a store's range from the master catalog. Stock check lets a manager confirm what the shop really carries. The flow goes top-down: department, then brand, then sizes. That makes it an hour's work instead of thousands of single decisions. Price review then only covers what is carried.

## Data

On `StoreProduct` (in migration `20261028120000_price_review`):

| Field | Meaning |
|---|---|
| `carried` | `null` is unconfirmed (onboarding's guess), `true` means the store stocks it, and `false` means not sold here |
| `carryCheckedAt`, `carryCheckedById` | When and by whom. Every row one call settles shares the same time, which is the undo batch |
| `carriedBefore` | What `carried` was before the last stock-check write. Undo restores it, so undoing "Sell again" puts a product back to Not sold rather than to unconfirmed |
| `suggested` | Onboarding listed this one hidden, as a less likely pick. The flag records where the listing came from and is never cleared |

**Visibility rule:** `isActive = carried ?? !suggested`. Undo sets `carried` back to `carriedBefore`, so a listing returns exactly to how it stood (for a first answer, how onboarding left it).

These listings are confirmed as carried automatically:
- a receipt or a stock count with stock on hand (`applyMovement`, RECEIVE/COUNT);
- listings picked by hand (`/store-products/bulk`);
- loose staples priced by the owner.

`scripts/backfill-carried.ts [--dry-run]` marks existing listings that have sales or real receipts as carried. Onboarding's "Opening stock" receipts don't count.

**Guards:**
- Order creation rejects inactive listings, and listings from another store ("Some items in your cart are no longer sold at this store").
- Re-applying the onboarding catalog never deletes `carried = true` listings.

## Onboarding: likely first

`pickAisle` ranks each aisle's products. The first `likelyPerAisle` go live, and the rest are listed hidden with `suggested = true`.

| Size | Visible per aisle | Listed per aisle |
|---|---|---|
| Kirana | 4 | 8 |
| Supermarket | 10 | 25 |
| Large | 25 | 60 |

You can override it in the admin wizard ("visible" next to the caps), or with `catalog.likelyPerAisle` in the onboard-store spec. The proposal totals show "Visible at launch" and "Hidden suggestions", and the aisle panel tags suggestions.

## API: `/api/v1/stock-check`

Every route needs `LISTING_AVAILABILITY` and access to the store.

| Route | What it does |
|---|---|
| `GET /summary?storeId` | Total, carried, not carried, unchecked, suggested (unchecked and hidden), checked today, and per-department counts with 3 sample photos |
| `GET /brands?storeId&departmentId&status=unchecked\|carried\|notCarried\|all&q` | Brands in a department that have listings in that state, with counts and 3 photos. Ordered by 30-day store sales, then brand popularity. Unbranded = `none` |
| `GET /products?storeId&departmentId&brandId&status` | Products, each with all its sizes (`carried`, `isActive`, `suggested`, price, MRP). `status` (from the brand tab) keeps only products with a size in that state |
| `POST /decide` | `{scope: {departmentId[, brandId][, only]} \| {storeProductIds}, carried}`. A department or brand scope only touches rows in state `only` (`unchecked` by default; `notCarried` for Sell again, `carried` for Stop selling). Returns `{updated, batch}` |
| `POST /sizes` | `{items: [{id, carried}]}` (max 200): the sizes screen's Save |
| `POST /edit` | `{productId, sizes: [{id, price}], newSizes: [{unitType, unitValue, price}]}`. Also needs `LISTING_PRICES`. Every size it touches is saved carried, visible and price-checked (KEPT/CHANGED), so Price review skips it. A new size reuses the product's catalog variant with the same unit and quantity, or adds one to the shared catalog (no MRP; named like "1kg", "6 pcs"). The price stays on this store's listing. A new listing starts with the largest stock of its sibling sizes, recorded as opening stock. Prices can't be undone |
| `POST /undo` | `{batch}`: each row back to its `carriedBefore`, with visibility to match |

The Today card shows "Products to confirm" (`stock_check`, the unchecked count). It never escalates and is left out of the urgent total.

**Price review is tied in:**
- "Not sold here" there is a carry write (`carried = false`).
- Its queue, totals and attention count only cover listings in range: `carried IS DISTINCT FROM false AND NOT (suggested AND carried IS NULL)`.
- Its Hidden tab became "Not sold".

## Manage app

`app/manage/stock-check/{index,brands,products}.tsx`, with components in `components/manage/stock-check/`. Entry points:
- the Today attention card;
- More → Stock → Stock check;
- a banner on Price review.

- **Departments:**
  - progress hero (carried / not sold) and 4 KPI tiles; tapping **Carried** or **Not sold** lists only the departments that have some, and opens their brands on that tab;
  - a card per department with photos, counts and **All / Some / None**;
  - None asks first with the count.
- **Brands:**
  - tabs **To confirm / Carried / Not sold / All brands**, so nothing you rule out is lost;
  - cards with logo, photos and "N products · M hidden suggestions", plus **Yes, all / No / Sizes**; on Not sold the card offers **Sell again / Sizes**, on Carried **Stop selling / Sizes**;
  - a decided card collapses in place with Undo;
  - a sticky bar handles the rest of the department in one go (with a confirmation).
- **Sizes:**
  - one switch per product turns all its sizes on or off; the size chips (showing the store's price) are the second level;
  - the pencil opens a sheet to fix each size's price and add sizes the catalog lacks (for example 1 kg at ₹60);
  - opened from a brand tab, it lists only that tab's products (from Not sold, just the not-sold ones);
  - size chips start as the shop shows them now;
  - All on / All off;
  - Save writes every size on screen and goes back.

Every write shows an Undo toast, and nothing auto-opens.

## Admin

`pages/stock-check/` under Inventory → Stock check:
- progress and KPI cards;
- a department table (All carried / None / Brands →);
- Carried and Not sold cards narrow the department table, like the app's tiles;
- Brands → opens the department in place (with "← All departments");
- a brand table with the same four tabs, per-row and bulk Yes/No (Sell again on Not sold, Stop selling on Carried) and "Rest of dept" on To confirm;
- a sizes drawer with a checkbox per product and per size, All on / All off, and the price editor.

Every write shows Undo. Price review shows a "Confirm what you stock first" banner while anything is unconfirmed.

## Tested (local, Template Store, `manager@martly.in`)

- **Reads:** summary 0.39s and brands 0.13s on 27.6K listings.
- **Not sold and Sell again:** Britannia No → 17 rows under Not sold → Sell again moved them to Carried → Undo put them back under Not sold (not unconfirmed). A size switched on and undone returned to not sold too. Admin did the same flow in headless Chromium, through the Not sold card.
- **Brand No:** 2 rows went `carried false`. A repeat Yes touched 0, since those rows are no longer unchecked. Undo restored `carried null`, visible.
- **Price review:**
  - row hide moved 1 row to Not sold, with totals excluding it; reopen by id restored it;
  - a brand bulk hide (15 rows) followed by batch reopen restored all of them.
- **Order guard:** a customer order for a hidden listing returned 400.
- **Access:** another org's store returned 403, and no token returned 401.
- **Onboarding:** I ran it on a throwaway KIRANA store, which was deleted afterwards.
  - Proposal: 801 products, 510 visible and 291 suggested.
  - Apply: 1,005 sizes visible and 537 hidden.
  - Re-applying with smaller caps removed 1,016 and kept the carried listing.
- **Backfill dry run:** 14 listings locally. Opening-stock receipts are excluded, since counting them would have marked all 16.9K.
- **Admin:** checked in headless Chromium. The page renders; Dairy → Britannia No → Undo restored the rows.
- **Typecheck:** API, admin and mobile (the new files).

## Needs manual verification

- Mobile screens on a device: department actions, brand collapse and Undo, size chips and Save.
- Admin: Sizes drawer Save, bulk Yes/No, "Rest of dept".
- **Prod:**
  - the migration runs with the API deploy;
  - then run `npx tsx scripts/backfill-carried.ts` against prod;
  - mobile needs a store build (no OTA).
