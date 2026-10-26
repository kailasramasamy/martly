# Loose staples

Unbranded rice, dal, atta, spices and the rest of Grocery & Staples that a store sells loose or in its own packs.

## Why

Onboarding lists only sizes with an MRP. Loose staples have none, so they waited in the wizard's "Need a price" table and a new store went live with branded dal and rice only.

Applying the catalog now lists them too, at their suggested price with the same opening stock, once the branded packs are in (so the aisle rate can be worked out). Only sizes with no reference price and no aisle rate stay in "Need a price". The owner adjusts prices afterwards on this screen or in inventory. `suggestPrices()` in `services/loose-staples.ts` is the one place starting prices come from, for the screen and for onboarding.

Tested: a throwaway kirana store got 1,542 listings, 237 of them loose (₹6–₹1,820), and 0 needed a price. Sree Ranga's proposal now shows 0 needing a price for its 848 unlisted loose sizes.

## Flow

1. **Manage → Product catalog → Loose staples** (`/manage/loose-staples`), also the "Loose rice, dal and flour" step in the storefront guide.
   - Aisles in catalog order, each size with a price box.
   - Tabs: To price / On sale / All, plus search.
2. **Starting prices** (`GET /loose-staples?storeId`):
   - first, what Martly's reference (template) stores charge for that size;
   - else the store's own going rate per kg or litre for branded packs in the aisle, less 10%.
   - "Use suggested" fills an aisle; "Fill every suggested price below" fills everything shown. A typed price is never overwritten.
3. **Save** (`PUT /loose-staples`, `LISTING_MANAGE`):
   - new sizes are listed at the owner's price with the opening stock from the bar (recorded in the stock ledger);
   - listed sizes are repriced and switched back on.
   - Only the organisation's unbranded staples are accepted.
4. **Loose first.** A category listing (no sort or brand filter) leads with the store's loose staples, labelled "Our brand", then the usual listing with brand boosts.
5. **Health.** `LOOSE_STAPLES` (Shop looks) counts staple aisles with something loose on sale, out of 6.

## Tested

- Sree Ranga: 58 aisles, 451 sizes, every one with a reference price (toor dal ₹156/kg, BPT rice ₹60/kg).
- Saving 2 toor dal sizes listed them; a branded variant was refused (400).
- Dal & Pulses listing led with the loose toor dal; paging total stayed right.
- Health check went to 1 of 6 aisles.

## Needs manual verification

- The mobile screen: filling, typing, saving, tabs, search.
- Category screen in the app showing loose items first.
