# Store specials

A **store special** is a collection of things a store makes or sources itself: its own bakery, sweets, hot snacks, cut fruit. Shoppers see it in the search screen's spotlight with a "Made at <store>" kicker, so in-store products stand apart from the branded ones in the same aisles.

## How it works

- **Collection type:** `STORE_SPECIAL` (`CollectionKind`, label "Store special (made in-store)"). Admins pick it like any other type when creating or editing a collection, in the admin panel or mobile Manage.
- **Per store without targeting:** a collection only shows products the store has in stock. A collection of one store's bakes therefore appears at that store and stays hidden everywhere else.
- **Search spotlight** (`services/search-landing.ts`): up to 2 live festivals or seasons as before, then up to 1 store special with stock at the store (most recently updated first). The app draws it with a warm bakery theme, a storefront icon and the kicker "Made at <store name>" (`OccasionSpotlight.tsx`, i18n `madeAt`).
- **Home:** the built-in `STORE_SPECIALS` block draws up to 2 store specials the store has in stock as the same spotlight cards the search screen shows (aisle pills open the aisle). It sits right after the hero banners in the default layout; at stores with none in stock it hides. Store specials never also get an automatic product shelf (`otherCollections` skips them).
- **Inside the range:** on a store special's card the aisle pills and "See all" open the collection itself (narrowed to that aisle), never the whole aisle with every brand. Its collection screen wears the same bakery-warm look (`campaignLook`).
- **Banner:** the collection page shows the AI banner card for store specials. Regenerating builds its art direction from the title and the products' aisles (`storeSpecialArt` in `services/seasonal/index.ts`) and costs 1 AI image credit, like other collection banners. An uploaded image works too.

## Setting one up

1. Create the store's own brand (Brands → a local brand), so search and listings rank it first when the org boosts its own brands.
2. Add the products under that brand in the right aisles (e.g. Bakery → Pav & Bun) and list them only at the store that makes them.
3. Create a collection with type **Store special**, add the products, and regenerate or upload the banner.

## Demo data

`npx tsx prisma/seed-store-bakery.ts` (set `TARGET_DATABASE_URL` for another DB) creates:
- the brand "Harur Fresh Bakes" and eight bakes listed at Harur Fresh Mart only, with painted photos
- the collection "Fresh from our oven"
- the store specials card on Home after "Regional pantry picks" (replacing the shelf an earlier run placed)
- the banner art, painted straight from the image model with no text in it (needs `OPENAI_API_KEY`)

It is safe to rerun.

## Tested

- `GET /search/landing` at Harur Fresh Mart: Diwali, Monsoon, then "Fresh from our oven" (STORE_SPECIAL, 8 products, 7 aisles). Harur Daily Basket shows only the festival and season.

## Needs manual verification

- The spotlight card on the phone, in English and Tamil.
- The admin "Regenerate banner" path designs with Claude; the local `ANTHROPIC_API_KEY` was rejected on 2026-10-24, so it was only exercised on prod.
