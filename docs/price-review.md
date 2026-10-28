# Price review

After onboarding, every listing sits at a price derived from the catalog MRP (`services/onboarding/catalog-apply.ts`). That is about 17K listings per store. Price review lets a manager settle them quickly: keep the price, change the price or the store's own MRP, or mark the product not sold here. Progress shows throughout. Confirm the range first in [Stock check](stock-check.md): the queue only covers listings the store carries or shows (not `carried = false`, and not unconfirmed hidden suggestions).

## Data

On `StoreProduct` (migration `20261028120000_price_review`):

| Field | Meaning |
|---|---|
| `mrp` | The MRP printed on this store's packs, when it differs from the catalog. Customers see `mrp ?? variant.mrp`. The master catalog is never touched. |
| `priceReviewedAt`, `priceReviewedById` | When the listing was settled, and by whom. `null` means it is still waiting. |
| `priceReviewOutcome` | `KEPT` or `CHANGED`. "Not sold here" is a carry write (`carried = false`, see stock-check.md), not an outcome |

- Every listing starts out pending, including ones added later.
- Setting the price or MRP from the normal listing editor also counts as `CHANGED`.
- `storeVariant(sp)` in `services/units.ts` swaps the store MRP into every serializer that sends a listing's variant: store-product-view, store-feed, store-products, recipes, smart-reorder, stores, ai and products. The web-shop cards (`services/web-shop/cards.ts`) read it directly. Clients still read `variant.mrp` and need no change.

## API: `/api/v1/price-review`

Every route needs `LISTING_PRICES` and access to the store. Hiding and reopening also need `LISTING_AVAILABILITY`.

| Route | What it does |
|---|---|
| `GET /summary?storeId` | Total, pending, kept, changed, not carried, MRP corrected, reviewed today, top sellers pending, and per-department totals with pending counts |
| `GET /groups?storeId&by=brand\|subcategory&status&departmentId&q` | Brands or aisles with pending counts and the usual % below MRP. Ordered by 30-day sales, then brand popularity. Unbranded listings use brand id `none` |
| `GET /items?storeId&status&outcome&brandId&subcategoryId&categoryId&departmentId&q&sort` | The queue, best sellers first. Reviewed items come newest first. `suspicious` means the price is under 50% of MRP |
| `POST /decide` | Up to 200 rows. A row with no change is kept, a new price or MRP is changed, `hide` marks it not sold here (`carried = false`). A price above the MRP returns 400 |
| `POST /bulk` | `confirm`, `hide` or `percentOffMrp` on a brand, aisle or department (only its pending rows), or on picked ids. `percentOffMrp` skips rows that have no MRP |
| `POST /reopen` | Takes ids, or a `batch` (the time a decide or bulk call returned). Puts the rows back in the queue, and sets not-sold ones back to unconfirmed. **Prices are not reverted**, so the UIs offer Undo only for keep and hide |

Raw SQL binds timestamps through `utc()` and `NOW_UTC` in `services/listing-sql.ts`. Prisma stores UTC wall time, but a raw `Date` parameter is read in the session's time zone, and that is IST locally.

The Today attention card shows "Prices to check" with the pending count (`price_review`). It never escalates.

## Manage app

`app/manage/price-review/`, plus components in `components/manage/price-review/`. Entry points: the Today attention card, and More → Stock → Price review.

- **Overview:** a progress hero with a single bar split into Kept and Changed, plus "+N today". Four tappable KPI tiles open the queue filtered to that outcome. A "Start with your best sellers" card, a department strip that filters, and a By brand / By aisle list of cards with **All N OK**, **Review** and ⋯ (set % below MRP, not sold here).
- **Queue (`items.tsx`):** the tabs are To check, Kept, Changed and Not sold.
  - The manager scans the list: each row shows its price, and ✓ keeps it in one tap.
  - Tapping a row opens it with the keypad. The quick bar on the keypad has MRP, −5%, −10%, hide and **Price OK** (which becomes **Save** after an edit).
  - Saving closes the row and the keypad, and the list stays in view. The next row is not opened automatically; the user found that too aggressive.
  - A settled row collapses in place with Undo (or Reopen, if the price changed).
  - Once everything loaded is settled, the next page is fetched fresh.
  - A brand or aisle queue ends with "Mark the remaining N as OK".

## Admin

`pages/price-review/`, under Inventory → Price review.

- Progress, KPI cards that filter, and a department strip that scrolls sideways.
- **Products tab:** an editable table. Enter in Price saves and moves to the next row's price, and Esc reverts. Select rows to Mark OK, set % off MRP, Hide or Reopen. "Save all edits (N)" saves every edited row.
- **By brand / By aisle tabs:** bulk actions per row.

## Tested

The tests ran on the local prod-synced DB, against Template Store, as `manager@martly.in`.

- **Reads:** summary, groups and items return the right counts and order. On 27.6K listings they took 0.17s, 0.28s and 0.9s.
- **Decide:** keep, change, MRP override and hide all set the right outcome. A price above MRP returned 400. Another store's listing returned 400, and another store's summary 403. Staff without pricing permission got 403.
- **Bulk:**
  - A brand confirm only touched pending rows (14 of 15 when 1 was already kept).
  - A brand at 8% off MRP repriced 56 rows correctly.
  - A brand hide followed by batch undo brought both listings back on the shelf.
  - Batch undo after `/decide` works (the time zone fix).
- **Customer view:** a store MRP override shows as `variant.mrp` in `/stores/:id/products`.
- **Admin, in headless Chromium:** the page renders with no runtime errors. Enter saved a price, removed the row, moved focus to the next row's price and updated the KPIs.
- **Typecheck:** passes for the API, admin and the mobile price-review files.

## Needs manual verification

- **Mobile screens on a device:**
  - the keypad quick bar stays above the keyboard
  - focus moves to the next row after Next
  - scroll-to-row on open
  - Undo toasts
  - the ⋯ sheet and bulk dialog
- **Admin dark mode and phone width**
- **Live bulk run:** a bulk "All OK" on a large brand on a real store, then check the shop shows the same prices.
- **Prod:** run the migration through the API deploy (`migrate deploy` on start). Mobile needs a new store build (no OTA).
