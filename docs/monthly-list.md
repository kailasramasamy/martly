# Monthly provision list

Feature 2 of the [store-experience plan](store-experience-plan.md). Town households do one big provision shop a month,
when salary or pension lands. The monthly list brings that shop back every month:
- It's ready on the day the shopper picks, at that day's prices.
- It flags what changed.
- It orders in one tap.

## Data

- **`MonthlyList`:** one per shopper per store (`@@unique([userId, storeId])`). It holds:
  - `reminderDay` (1–28, so every month has it), `pushOn`, `whatsappOn` and `isActive` (paused).
  - `lastRemindedMonth` and `lastOrderedMonth`, as "2026-10".
- **`MonthlyListItem`:** `productId`, `variantId` (the size), `quantity`, and `lastPrice` / `lastOrderedAt` for the
  up/down chip. `@@unique([listId, variantId])`.
- **`HomeSectionType.MONTHLY_LIST`:** placed right after `HERO_CARDS` in saved layouts.
- **Migrations:** `20261025140000_monthly_list_section_type`, `…140100_monthly_lists` and `…140200_monthly_list_home_section`.

## API (`/api/v1/monthly-list`, signed in, always the shopper's own list)

| Route | What it does |
|---|---|
| `POST /` | Creates or restarts the list. `source: "ORDER"` starts from the **biggest order at the store in the last 45 days** (or `orderId`); `"LINES"` takes cart lines. 404 when there's no order to start from |
| `GET /?storeId=` | The list at today's prices: items (each with its listing, `inStock` and `delta` against `lastPrice`), `total`, `due` and `changes` |
| `PUT /:id` | Reminder day, channels, pause |
| `PUT /:id/items` | Replaces the lines. Sizes kept are **upserted, not recreated**, so they keep their id and last price, and the app's this-month choices still point at them. Lines keep the order sent |
| `GET /:id/items/:itemId/options` | What a line can be swapped for, in stock: `sizes` (the same product's other sizes, smallest first) and `brands` (up to 12 others in the subcategory, closest in size then price, none already on the list) |
| `POST /:id/quick-order` | Quote for a one-tap order: the address, delivery and amount, or why it has to go through checkout |

**Placing an order:** an order that carries `monthlyListId` sets each line's `lastPrice` / `lastOrderedAt` and the
list's `lastOrderedMonth` (`recordMonthlyListOrder`), whichever screen placed it.

### Things to check (`services/monthly-list/changes.ts`)

- **Out of stock:** the size isn't available. The swap offered is the in-stock product in the same subcategory
  closest in size, then in price (`closestTo` in `options.ts`). It applies to this month only.
- **Bigger pack saves:** `packDeals()`, the same check the cart uses. Accepting it changes the list.
- **Not bought lately:** not ordered in 60+ days. "Remove" takes it off the list.
- **New usual:** a habit from `predictReorders` that repeats every 20–40 days and isn't on the list (at most 3).

### One-tap order (`services/monthly-list/quick-order.ts`)

- Pays **cash or UPI on delivery** only. Online payment opens checkout with the lines in the cart and `monthlyListId`
  set.
- Uses the default address, else the newest one.
- Uses express delivery if it's open now, else the soonest slot.
- The fee comes from `services/delivery/fee.ts` (`deliveryFeeTo`), shared with order creation: distance tier, then
  zone, then the store's base fee, with the free-delivery threshold and the member waiver.
- **Blocks:** `NOTHING_IN_STOCK`, `NO_ADDRESS`, `NOT_SERVICEABLE`, `NO_DELIVERY` and `BELOW_MINIMUM`. Each one sends the
  shopper to checkout instead.

## Reminders

- **Scheduler:** `plugins/monthly-list-scheduler.ts` runs daily at 07:00 IST. It reminds active lists whose
  `reminderDay` is today and that haven't been reminded this month.
- **Each reminder** carries the total at today's prices and the number of changes.
- **Channels:**
  - An app push (`data.screen = "monthly-list"` opens the list).
  - WhatsApp through Interakt (`services/whatsapp/interakt.ts`), when the shopper turned it on.
- **Interakt env:**
  - `INTERAKT_API_KEY` and `INTERAKT_MONTHLY_LIST_TEMPLATE`, plus `INTERAKT_TEMPLATE_LANGUAGE` (default `en`).
  - With no key, or with `DISABLE_WHATSAPP=true`, the message is logged instead of sent. Always set
    `DISABLE_WHATSAPP=true` locally, as well as `DISABLE_PUSH`, because the local DB has real customers.
- **Template to get approved (English and Tamil):** "Hi {{1}}, your {{2}} list from {{3}} is ready: {{4}} items, ₹{{5}} at
  today's prices. Open Martly to check and order."

## Mobile

### Home strip (`components/home/sections/system/MonthlyListSection.tsx`)

- A one-row card with "Your October list is ready", the item count, today's total and "N changed", plus an **Order**
  pill that opens the list with the order sheet up.
- It shows from the reminder day until the list is ordered that month.

### The list (`app/monthly-list.tsx`)

- **Layout:** one white card per aisle. Each row has a tick, photo, name, size ▾, an up/down price chip, the price and
  a stepper.
- **Changes for this month only** (local state in `use-month-plan.ts`): the tick (leave it out this month) and the
  out-of-stock swap.
- **Changes saved to the list for later months:**
  - Quantity: debounced 600 ms.
  - Swap: tap the photo or name to open **SwapSheet**, with other sizes, other brands (with ₹/kg or ₹/L) and Remove.
    A swap keeps the line's place and quantity; picking a size already on the list merges the two.
  - Remove: − at quantity 1 is a bin icon.
  - Add: **+ Add an item** opens **AddItemSheet**, which searches the store with one chip per size. Sizes already on
    the list show a tick.
- **Walk the store** opens the walk with `from=monthly-list`. `ListCart` puts the list in the cart's place
  (`CartScope` in `lib/cart-context.tsx`), so the shelf + adds to the list.
  - The dock reads "On your list: N items · ₹X", and finishing or the bag goes back to the list.
  - Saves are queued (`list-saves.ts`). The list screen waits for them on focus, then reloads.
- **"Every 25th"** in the header opens the settings sheet. The amber banner opens Things to check. **Order** opens the
  one-tap sheet.

### Entry points

- The Home strip and the push notification.
- Account → Monthly list.
- "Save as my monthly list" in the cart (signed in, at the selected store).
- "Make this my monthly list" on a delivered order.

## Search fix that came with it

- **The problem:** "rin soap" didn't find Rin Detergent Bar, because "soap" isn't in its name.
- **The fix:** `services/search.ts` adds a match tier for a brand plus a word for its shelf. The query names the
  product's brand, and every other word starts a word of the subcategory's name or search terms (Detergent Bar has
  "washing soap", "thuni soap").
- **Name tiers now:**
  - 0: whole phrase
  - 1: word-start phrase
  - 2: every word starts a name word
  - 3: brand + shelf
  - 4: substring
  - 5: translated name
  - 6: description
- **Effect:** substring-only hits ("glyce**rin soap**") now rank below the brand.

## Tested

- **API (curl, review user at Harur Fresh Mart):**
  - create from order, GET, settings and items
  - guest 401; another user's list 404; bad input 400
- **Quote vs real order:** both matched.
  - ₹208 of items: ₹20 fee, ₹228 to pay.
  - The full list: ₹3,347 quoted and charged.
  - After ordering, `due` is false and `lastOrderedMonth` is set.
- **Quote edge cases:** BELOW_MINIMUM under ₹99; with express off it falls back to a slot.
- **Swap options:** checked for all 9 seeded lines (sizes, and 12 brands each). An unknown item gives 404.
- **Saving lines:** keeps the same ids, order and last prices.
- **Search:** rin soap, lifebuoy soap, aashirvaad atta, surf excel powder, thuni soap, rin, dal, oil, ponni rice and
  hamam rank as expected.
- **On the phone:** the Home strip, the list, removing with the bin, and adding by search (verified working).
- **Type checks:** the API is clean; mobile has the same 14 errors it had before.
- **Seed:** `cd apps/api && npx tsx prisma/seed-monthly-list.ts [phone]` builds a 9-staple list (defaults to
  `OTP_REVIEW_PHONE`). It sets the reminder day to today and one price change.

## Needs manual verification

- **Phone:**
  - Swap a size and a brand.
  - Walk the store from the list and come back.
  - Things to check: each kind.
  - One-tap order with cash on delivery, and the online hand-off to checkout.
  - Everything again in Tamil.
- **Interakt:** an API key and approved English and Tamil templates, then one real WhatsApp send.
- **Known:** "vim soap" ranks Vim dishwash liquid above the bar; both shelves are tagged with "soap".
- **Ships with a store build:** mobile has no OTA updates.
