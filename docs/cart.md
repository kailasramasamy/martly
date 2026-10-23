# Cart review (phase 1)

The cart re-checks itself with the store and suggests what's worth adding, without crowding the screen.

## Flow

1. Whenever the cart's lines change (debounced 300 ms), the app calls `POST /api/v1/cart/review` with
   `{ storeId, storeProductIds, gap? }` (sign-in optional). `gap` is the rupees still needed for the
   minimum order, or for free delivery once the minimum is met.
2. The reply (`services/cart-review.ts`):
   - **`lines`**: each cart line as the store sells it now (pricing, MRP, `availableStock`). A line missing
     from the reply was deactivated and can't be bought.
   - **`forgotten`**: the shopper's due or overdue usual items (`predictReorders`) that aren't in the cart, in
     the size they buy, in stock. Empty for guests. Only habits count: bought at least twice, with those purchases
     spread over 7+ days, and from a **restockable** subcategory. `Subcategory.restockable` is off for durables
     and seasonal items (brooms, bottles, bulbs, diyas, gift packs; 24 at launch) and is set in admin under
     Categories → edit subcategory. Smart Reorder and the search page's Buy Again rail skip these subcategories
     too; the list-to-cart matcher doesn't, because there "broom" should still find the broom you bought before.
   - **`gapFillers`**: up to 8 in-stock items whose effective price is between the gap and
     max(1.5 × gap, gap + ₹40). Never from the cart's own categories, so a salt cart isn't offered more salt.
     Ranking: the cart's departments first (salt → atta, besan, spices), then the store's 90-day best
     sellers, then brand popularity. At most 2 per subcategory.
3. The app (`components/cart/use-cart-review.ts`):
   - **Reprices** stale lines through `cart-context.repriceItems` and notes "Price changed from ₹X" on the line.
     The order is still priced on the server; this only keeps the cart honest.
   - **Flags stock**: "Only N left" (the + button stops there), or "Out of stock" with a Remove button.
     While any line is out of stock, the checkout button reads "Remove unavailable items" and removes them.
   - **Savings**: Σ (pre-discount price, else MRP when higher, minus the price paid) × quantity. It shows as
     "Your savings" in the bill and "Saved ₹X" on the checkout button.

## Screen, top to bottom

Store header → **OrderGoal** progress bar (minimum order in orange, otherwise free delivery in teal; hidden once
reached) → lines → **"Add one of these"** (gap fillers, only while there's a gap) → **one** more rail:
"Did you forget?" if there are due items, otherwise "Customers Also Bought" → rewards → bill → checkout button.

## Customers Also Bought

`GET /stores/:id/frequently-bought-together` (also used for the product page's "Frequently bought together")
returns only real patterns: products bought together in at least 3 delivered orders from at least 3 different
customers in the last 90 days. With less data it returns nothing and the rail hides. It no longer fills in
with best sellers, which made the label untrue.

## Bug fixed

Grand total and the checkout button used to ignore the store's flat delivery fee. They now add it when
delivery isn't free. If the store has no flat fee, the bill says "At checkout" (the fee depends on the address).

## Tested

- `POST /cart/review` with curl at Harur Fresh Mart:
  - An out-of-stock line comes back with `availableStock: 0`.
  - A logged-in review user gets 7 due staples.
  - A guest gets none.
  - The gap fillers for a lassi cart are dairy drinks and lassi in the price band.
  - A bad body returns 400.
- API and mobile type-check clean for the touched files.

## Test data

`cd apps/api && npx tsx prisma/seed-cart-review.ts` back-dates a repeat-purchase history at Harur Fresh Mart
for the OTP review login (`OTP_REVIEW_PHONE`), so milk, curd, eggs, bread, atta, detergent and ghee are due.

## Needs manual verification

- On the phone, signed in as the review login at Harur Fresh Mart:
  - Below ₹99, the orange bar and gap fillers show, and checkout is locked.
  - Between ₹99 and ₹249, the teal free-delivery bar shows, and the total includes the ₹20 fee.
  - At ₹249 or more, the bar is gone and delivery is Free.
- "Did you forget?" replaces "Customers Also Bought" when there are due items.
- Out-of-stock: set a cart line's stock to 0 in admin, then reopen the cart.
- Price change: edit a cart line's price in admin, then reopen the cart.
- Tamil strings.

## Phase 2

`/cart/review` now takes `lines: [{ storeProductId, quantity }]` and `itemTotal`, and also returns:

- **`packDeals`** (`services/pack-deals.ts`): for each line, the bigger size of the same product that costs least
  per g / ml / piece. Sizes are compared in a common unit (KG/GRAM, LITER/ML, PIECE/DOZEN; packs and bundles
  aren't compared). The bigger size must cover at least what the line holds, be at most 3× it, and save ₹2 or
  more. The line shows "Switch to 1 × 1kg · save ₹34" (same amount, costs less) or "Get 1kg for ₹37 more ·
  save ₹34". Switch swaps the line in place (`cart-context.replaceItem`).
- **`coupon`**: the best advertised coupon that applies now, else the nearest one to unlock, if it's within
  max(₹150, cart total). Apply saves it as the pending coupon that checkout applies, the same as a coupon
  saved from Home.
- **`plusOffer`**: for non-members, the cheapest active plan with free delivery. It's shown only while the cart
  pays for delivery and opens the membership screen.

On the app:

- **Tap a line's picture or name** to open the product page.
- **Save for later**: the toast after removing a line offers Undo and Save for later, which adds it to the
  wishlist. It only shows for signed-in shoppers when the item isn't already wishlisted. Toasts now take a
  list of actions.
- **Empty cart**: "Repeat last order" (the same flow as Home's Last order pill) and "Your usual items", from
  a cart review with no lines.

Tested with curl at Harur Fresh Mart:

- Bajra 500g ×1 → 1kg, +₹37, saves ₹34.
- Bajra 500g ×2 → 1kg, +₹0, saves ₹34.
- Chilli 100g → 200g, saves ₹105.
- Brown chana gets no deal, because its 1kg costs more per kg.
- SNACK30 applies on ₹285 and is ₹57 short on ₹142.
- The plan offer is Mart Plus Monthly, ₹49.
- The empty cart returns the review login's 7 usual items.
