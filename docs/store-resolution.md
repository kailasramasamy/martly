# Store resolution: shop first, store picked for you

Shoppers start shopping straight away, in the app and on martlyshop.in. Martly picks the store for them and shows "from {store} · Change"; prices and stock always come from that store, and an order comes from one store.

## Flow

1. **Pick:** `GET /api/v1/stores/resolve?current=&lat=&lng=&town=` (`apps/api/src/services/store-resolve.ts`), in order:
   1. `current` (the store the shopper chose before) while it is live → `kept`
   2. with a location: the nearest store that delivers there, else the nearest in 20 km → `nearest`
   3. the town's main store (most active listings, then earliest launched) → `town`
   4. Martly's main store → `default`

   It returns the store, the reason, `deliversToYou` (null without a location) and `alternatives` (stores in range, or the town's other stores). Template-org and non-ACTIVE stores never show.
2. **App** (`apps/mobile/lib/store-context.tsx`): resolves on launch (saved manual pick + location), again when location is granted, and after sign-out. Only a store the shopper picked is saved. Home has no store gate; the header says "Pickup only at your location" when the store doesn't deliver there. The store screen asks to turn on location when it's off.
3. **Web** (`apps/web`): the same endpoint behind the header picker, remembered in cookies (see docs/web.md).
4. **Changing store moves the cart:** `POST /api/v1/cart/transfer { toStoreId, lines }` returns `moved` (the same sizes at the new store's prices, capped at its stock) and `missing`. The app (`lib/move-cart.ts`) swaps the cart in one step and shows a toast with Undo, which brings back the old store and cart. Adding a product from another store asks "Move your cart here?" and moves the cart with the new item.

## Tested

- `/stores/resolve`: no params → default; town → main store; a point near Kaveri Fresh → nearest, `deliversToYou` true, alternatives; `current` kept; invalid `current` → 400.
- `/cart/transfer`: 6 lines → 4 moved at Kaveri's prices, 2 missing.
- Mobile type-check of the changed files.

## Needs manual verification (device)

- Fresh install with location denied: Home shows Dharmapuri's main store's products with no gate.
- Grant location: switches to the nearest store that delivers.
- Fill the cart, change store: toast with missing count; Undo restores store and cart.
- Add from another store (deep link/brand page): "Move your cart here?" moves the cart and adds the item.
- Tamil strings on all of the above.
- Ships in the next app build (no OTA).
