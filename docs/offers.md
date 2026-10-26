# Offers

**More → Marketing → Offers** in the app's Manage side: one place to see and start a store's offers on many products
at once. It needs the "Change prices" duty (`LISTING_PRICES`), the same as setting an offer on one listing.

## Kinds

| Kind | Stored on the listing | Shows shoppers |
|---|---|---|
| Buy X get Y | `offerBuyQty`, `offerGetQty`, `offerStart`, `offerEnd` | "Buy 2 Get 1" tag, free units in the cart, the Home hero card once 3 products have one |
| Discount (₹ or %) | `discountType`, `discountValue`, `discountStart`, `discountEnd` | The discounted price everywhere |
| Member price | `memberPrice` = price less a whole % (1–90), rounded down to the rupee | Mart Plus members' price; no dates, so always Live |

Offers live on the same listing columns that the Edit listing screen sets, so cart, checkout and Home need nothing new.
A listing with more than one kind shows as one offer per kind.

## Flow

- **Offers**: Live, Scheduled and Ended tabs, plus a product search. Tapping an offer opens that size's Edit listing
  screen, and long-pressing it ends the offer, which clears that kind's columns.
- **New offer** (+): "On products" kinds (Buy X get Y, Discount, Member price), and "On the whole order" links to the
  existing New coupon and New promotion screens. Then the terms (1 + 1, 2 + 1 or custom; flat ₹ or percent; member % off), optional start and end dates,
  then **Pick products**, which searches the store's listings and allows several sizes at once. **Start offer** puts it on
  every picked size, replacing an earlier offer of the same kind.
- The product page (Products → a product) has a **Price, stock & offers** card listing that product's sizes at the store,
  each opening its Edit listing.

## Admin

**Marketing → Offers** in the admin panel matches the app, under the same `offers` permission:

- **Offers** (`pages/offers/list.tsx`): store, Live / Scheduled / Ended, product search; a table with the offer, price and
  dates. **Edit listing** opens the store-product edit page; **End** (with a confirm) clears that kind.
- **New offer** (`pages/offers/create.tsx`): store, kind (Buy X get Y uses the shared `OfferCard` presets; Discount; Member
  price %), links to New coupon and New promotion for order-wide offers, then a search box over the store's listings to
  add sizes, listed below with remove. **Start offer** posts to `/offers`; API refusals show as messages.

## API

`routes/offers/index.ts`, logic in `services/store-offers.ts`, schemas in `packages/shared/src/schemas/offers.ts`.

| Endpoint | |
|---|---|
| `GET /offers?storeId&status=live\|scheduled\|ended&q` | Paged offers of both kinds, soonest to end first |
| `POST /offers` | `{ kind, storeId, storeProductIds, buy/get or discountType/discountValue, startsAt?, endsAt? }` |
| `POST /offers/end` | `{ kind, storeId, storeProductIds }` clears that kind |

Every listing must belong to the store, and the caller must manage the store. A flat discount at or above a picked
listing's price is refused, naming the listings.

## Tested (local, 2026-10-26, Sree Ranga owner login)

- 2 + 1 on three Surf Excel sizes: they listed as live, and Home's hero gained the Buy X get Y card.
- A 10% discount starting tomorrow listed under Scheduled, then ended through `/offers/end`.
- Refused: a ₹5,000 flat discount, an end before the start, another store's listing, and the rider login (403).
- Member price (service-level against the local DB, 2026-10-26): 15% on ₹132 and ₹225 sizes set ₹112 and ₹191, listed
  under Live only, ended back to null; 0%, 95% and 10.5% refused by the schema.
- Typecheck clean for the API, admin and the new mobile files.

## Check by hand

- Admin: Marketing → Offers, pick a store, New offer → each kind → Start offer; End from the list.

- On the phone: More → Marketing → Offers, + → pick products → Start offer; long-press to end; the date pickers.

## Next

Deal of the day (phase 2): a special price for one date, a "Deals of the day" strip on Home with a countdown, and a
deal badge on the product card. It needs its own columns and a migration.
