# Pack Sizes: Order and Default

Two separate rules, so shoppers both find sizes easily and land on the one they want.

## Order: smallest first

A product's sizes are listed smallest to largest (grams/millilitres compared across g/kg and ml/L, ties by MRP), as in
every grocery app: shoppers scan sizes like a ruler and compare the per-100 g price as packs grow. `bySize` in
`@martly/shared/listing`; the API sorts one product's listings with it (`GET /stores/:id/products?productId=`), and the admin
brand page uses it too.

## Default: the size the shopper is most likely to buy

People overwhelmingly keep a preselected option (the default effect), and grocery is mostly repeat buying, so the default
does the work, not the order. The API marks one listing per product with `preferredSize: true`
(`plugins/preferred-sizes.ts`, `services/preferred-sizes.ts`), the first of these the store has in stock:

1. **The size this shopper bought last**, in any store (signed-in customers).
2. **The store's most bought size** of that product over the last 90 days.
3. **Martly's most bought size** across all stores, for a store with no sales of it yet.

With none of these, the app falls back to the smallest size in stock. Best sizes are cached and refreshed every 30 minutes;
"last bought" is looked up per response. The flag is added to every listing a response carries, on a copy, so cached responses
stay per-shopper clean.

The app (next build) opens cards on the preferred size, and the product page on the size the card showed (`size` param),
else the preferred one, else the smallest in stock. The row of sizes stays smallest first.

Deliberately not used: putting the biggest pack first to anchor prices, or decoy sizes. Both lift spend once and cost trust.

## Tested (local, prod copy)

- Black Grapes at Sree Ranga, anonymous: sizes 500g, 1kg; 1kg marked (the store's best seller).
- Pomegranate: a shopper who last bought 4 pcs gets 4 pcs; one who last bought 1kg gets 1kg; sizes stay in the same order.

## Needs manual check (after the app build)

- A card opens on the last-bought size; tapping it opens the product page on that size; changing the size on the card first
  opens the page on the changed size.
