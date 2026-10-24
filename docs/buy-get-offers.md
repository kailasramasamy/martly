# Buy X Get Y offers

Local grocery shoppers look for "Buy 1 Get 1 free" deals. A store can now put a buy X get Y offer on any listing: every X units the shopper pays for bring Y more free (1+1, 2+1, 3+1, 2+2, or any 1–10 pair).

## How it works

**Setting an offer.** It lives on the store listing (`store_products.offer_buy_qty`, `offer_get_qty`, `offer_start`, `offer_end`), apart from the flat/percent discount. A listing can carry both, for example ₹45 (10% off) plus Buy 1 Get 1. Editing needs the `LISTING_PRICES` permission, the same as discounts.
- Admin: Store products → create or edit → Offer card (presets or Custom, optional dates).
- Mobile manage: inventory edit form → Offer (None / 1+1 / 2+1 / Custom).

**Pricing.** `calculateEffectivePrice` reads the offer off the listing and returns `pricing.offer: { buy, get } | null`, active now. The unit price is unchanged. The math lives once in `@martly/shared/offers`:
- `freeUnits(qty, offer)` = ⌊qty ÷ (buy+get)⌋ × get
- `lineTotal(price, qty, offer)` = price × (qty − free)
- `offerNudge(qty, offer)` = what to add next ("Add 1 more, it's free" or "Add 1 more, get 1 free")
- `paidPerUnit(line)` = totalPrice ÷ quantity, the refund base

**Orders.** `POST /orders` stays the authority. Each line saves `freeQuantity`, and `totalPrice` covers only the paid units. Stock is reserved for every unit, free ones included. Coupons apply to the total after free units are taken off.

**Refunds.** Return requests and door refusals refund what each unit was actually paid (free units averaged in). Returning one unit of a 1+1 pair bought for ₹50 refunds ₹25.

**Customer app.**
- Product cards and the product page show a dark-teal "Buy 1 Get 1" tag with a gift (Tamil: "1+1 இலவசம்"). It replaces the "% OFF" tag on that card.
- Cart lines show the offer and "N free", strike the full price above the charged total, and nudge part-way through an offer with a one-tap Add.
- Cart savings and checkout line totals count the free units. Customer, manage and admin order lines read "3 × ₹50 · 1 free".
- Cart lines refresh their offer from `POST /cart/review`, so an offer that starts, ends or changes after the item was added is picked up.

**Home and the full list.**
- Section type `BUY_GET_DEALS`: a gift band (teal, amber ribbon, "1+1" badge) over a rail of the 10 best offers. The most generous share comes first. It hides when the store has none.
- Saved layouts got it right after Deals of the Day (migration `20261025090100_buy_get_home_section`). The default layout has it too. Move it in Admin → Home layout.
- "View all" opens `app/buy-get.tsx`: category chips plus a 3-column grid, paged from `GET /home/:storeId/buy-get?categoryId=&page=`.
- Only the size on offer is listed, so the card shows the deal.

## Not in this version
- "Buy A, get B free" across different products.
- Offers run as scheduled promos (the promo engine still writes only flat/percent discounts).
- Subscriptions and price-band deals ignore offers.

## Tested
- Shared math: 14 cases covering free units at 1+1/2+1, line totals, nudges, paid per unit, and refused-unit value. All pass.
- `GET /home/:storeId/buy-get`: 16 offers at Harur Fresh Mart, 5 category chips, `pricing.offer` set.
- `GET /home/:storeId/sections`: `BUY_GET_DEALS` comes back with 10 products, total 16.
- `POST /orders` (in-process, push disabled): 3 units at 1+1 for ₹295 charged ₹590 with 1 free; 3 units at 2+1 for ₹379 charged ₹758 with 1 free; order total ₹1,348. The test order was cancelled.
- API, admin and mobile typecheck.

Seed: `cd apps/api && npx tsx prisma/seed-buy-get-offers.ts` (16 offers per active store, every fourth one 2+1).

## Needs manual verification
- Home row and the full list on a phone, English and Tamil.
- Add 1 of a 1+1 item → cart nudge → tap Add → "1 free" and the total is unchanged.
- Place a real order: the order detail shows "· 1 free" in the customer app, manage app and admin.
- Setting and clearing an offer from admin and from the manage app.
- A delivery with one unit refused at the door: the refund is the paid share.
