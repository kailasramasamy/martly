# Store Brand Names

Branded products carry their brand in the title ("Tata Sampann Toor Dal"). A store's own packs, the unbranded products in the
Grocery Staples department, now carry the store's brand the same way: "Ranga Toor Dal" at Sree Ranga, "PSB Toor Dal" at PSB.

## How it works

- **Setting:** `stores.brand_name`, plus a Tamil brand name in `stores.translations.ta.brandName`. Owners set both in admin
  (Store → Storefront Branding) or in the app (Manage → Storefront → Branding). Left empty, the brand is the store name without
  "Store", "Department Store", "Supermarket" or "Mart" (`storeBrandName` in `@martly/shared/constants`). Tamil falls back to English.
- **Titles:** the catalog keeps "Toor Dal". The API retitles in responses (`plugins/store-brand-names.ts`, `services/store-brand-names.ts`):
  every product under a `storeId` (a listing, cart line or order), or in a request with `?storeId=`, gets the store's brand in front, in English and
  Tamil, unless the title already starts with it. Responses are copied, never mutated, so cached objects stay clean. The website's
  cards set the title in `web-shop/cards.ts`. So the app needs no new build.
- **Brand name everywhere the store shows as a brand:** the brand chip, brand page, search brand filter, and the brand scroller, where
  the store's own brand comes first in the app and on the website (`storeBrandRail` in `services/own-brand.ts`).
- **Search:** the store's brand is taken out of a search, so "ranga toor dal" finds the store's toor dal packs (`withoutStoreBrand`).
- **Freshness:** brand names and staple aisles are cached in memory, refreshed every 5 minutes and right after a store's branding is saved.

## Tested (local, prod copy, Sree Ranga = "Ranga", PSB = "PSB")

- Store listing search "toor dal" (PSB): "PSB Toor Dal" / "PSB துவரம் பருப்பு"; branded products unchanged ("Tata Sampann Organic Toor Dal").
- Search "ranga toor dal" (Sree Ranga): Ranga Toor Dal packs first; brand filter shows "Ranga".
- Product detail with `?storeId=`: "Ranga Toor Dal"; without it the catalog title "Toor Dal".
- Brand scroller `/brands/store/:id`: Ranga first. Website home brand rail: Ranga first, linking to `/{town}/{store}/brand`.
- Website product page `/web/products/toor-dal`: title and brand chip "Ranga"; website search cards retitled.
- `POST /cart/review`: lines retitled. Produce (unbranded, not staples) is not retitled.

## Needs manual check

- An order with a staple in it (no local order had one): order history and order detail should show "Ranga Toor Dal".
- The app's Branding screen fields (ship with the next app build).
