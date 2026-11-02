# Walk the store: realism plan

Plan to make [Walk the store](store-walk.md) feel like a real shop: a real shelf unit, packs that react to offers and
popularity, and packs the shopper can pick up. Agreed scope (2026-11-01): **Phase 0 (cut-out pilot), Phase 1 and
Phase 2.** Phase 4 is parked until the open decisions below are made.

## Why it still reads as an app

1. **Shelves are cards.** Each shelf is a separate white card with three packs; a real shelf is one tall unit, packed
   edge to edge, with depth.
2. **Packs are photos on white.** Catalog photos have white backgrounds, multiplied onto the shelf. That forces the white
   shelf, rules out a dark back panel or contact shadows, and is why stacked facings were dropped.
3. **Nothing moves after the aisle opens.** Every animation is an entrance; nothing on the shelf reacts to offers,
   popularity or touch beyond the +.

## Order of work

Cut-outs come first, as a pilot. Most of Phase 1's look depends on them:

| Phase 1 item | With white-background photos | With cut-outs |
|---|---|---|
| Dark back panel, shelf lighting | Multiply darkens the whole photo | Pack stands in front of it |
| Contact shadow under each pack | Shadow falls on the white square | Shadow follows the pack |
| Pick up / drag to basket | A white tile lifts off | The pack itself lifts off |
| Stock level shown as fullness, depth | Clashing backgrounds (why facings were dropped) | 2–3 facings deep |
| Shine sweep on a bestseller | Sweeps the white margin too | Sweeps only the pack |

Animations triggered by offers and popularity (flag flutter, swinging tag, "FREE" pack wobble) don't need cut-outs, so
Phase 1 is built cut-out first, with today's white-shelf look kept as the fallback for any pack without one.

## Phase 0: cut-out pilot

- `products.cutout_url` (nullable): the product photo with its background removed, trimmed to the pack, as webp with
  alpha, on the CDN (`MEDIA_PUBLIC_BASE_URL`).
- One cut-out per product, shared by every store. The original photo stays: white cards, the product page and anything
  shared (WhatsApp previews, notification thumbnails, shopping feeds turn transparency black) keep using it, and a better
  model later re-cuts from it. The cut-out goes wherever a pack stands on a coloured surface.
- `prisma/generate-cutouts.ts` takes `--category` (repeatable), `--store`, `--limit` and `--force`:
  - a photo already transparent at its edges (the F&V cutouts) is its own cut-out
  - a pack on white: the white joined to the photo's edges is flood-filled away (milliseconds), and the pale pixels
    along the outline fade out so no white fringe shows on a dark shelf
  - a pale pack (more than a quarter of the ring 3 px inside its outline lighter than 215), which the fill could run
    into, is cut by rembg's `birefnet-general` instead (~60 s on this Intel Mac; set up as in the clean-logo skill). It
    passes when it keeps 85% of the photo's non-white pixels
  - a photo whose edge isn't white (a styled scene) gets no cut-out; nor does a model cut that fails. Either clears an
    old cut on a `--force` run
  - products with a `packPhotoUrl` are skipped (store pack renders are already cut tight)
- Tried and dropped (2026-11-01): `isnet-general-use` turns flat-coloured boxes and pouches see-through (16 of the first
  40 failed); a gap test for leaks flagged pouches' sealed ends as gaps.
- First 40 (Atta & Flours + Biscuits, A–Am): 35 flood-filled, 1 by the model, 2 scenes, 2 model fails, in 2 minutes.
  Four "packs" are styled photos inside a white frame, so they come out as square photo tiles. Next: pick a white-edged
  packshot from the product's gallery `images` when the main photo is a scene or framed photo.
- Pilot: every product in Atta & Flours (236) and Biscuits & Cookies (471).
- Spot check the pilot on the phone before running it wider. The pass bar: no halo on white packs (milk, salt, atta),
  clear packs (oil bottles, honey) keep their contents.
- Then the store's stocked range (Sree Ranga: ~12K products) in batches; new products get a cut-out on create, like
  Tamil translation.

## Phase 1: shelf unit, animations and touch (mobile)

### Shelf unit
- One continuous gondola per aisle: metal uprights at the sides, a dark back panel, an LED light strip under each
  shelf, a soft contact shadow under each pack.
- The front edge becomes a plastic price rail; the handwritten stickers stay.
- Packs with a cut-out stand on it; packs without one keep a white backing plate so they still read cleanly.

### Animations driven by offers and popularity
Each plays once, when its shelf first scrolls into view (`onViewableItemsChanged`), and again only on a new aisle
visit. No more than two animated packs per shelf. Reduce Motion turns them all off.

| Signal | Animation |
|---|---|
| Buy X get Y | A second pack with a "FREE" tag peeks from behind and wobbles in |
| Saving 20%+ | The red flag flutters 2–3 times |
| Bestseller in the aisle (Phase 2 flag) | A shine sweeps across the pack, gold "Bestseller" tag |
| Trending (Phase 2 flag) | A small "N bought this week" tag rises in |
| Owner's pick | The teal tag swings like a hanging card |
| 5 or fewer left | The pack stands a little askew, gap beside it, one small shake |
| New (Phase 2 flag) | A "NEW" starburst pops |

### Touch
- **Pick it up:** tapping a pack lifts it off the shelf (grows, shadow, tilts) and opens a quick view: sizes, price,
  description, Add. "View details" goes on to the product page. Today a tap leaves the walk.
- **Drag to basket:** pulling the lifted pack down to the basket adds it. The + stays.
- **Haptics:** light tap on add, when the sign settles and on an aisle change.

### Walk
- **Basket to trolley:** the dock's basket becomes a trolley past 8 items.
- **Walk forward:** a new aisle zooms into the aisle photo, like walking down it, instead of the sideways slide. Going
  back keeps the slide.

### Native libraries
`expo-haptics`, `react-native-reanimated` and `react-native-gesture-handler`. The drag runs on the UI thread, where
`PanResponder` would stutter on low-end Android. The app has no OTA updates, so every
mobile change needs a store build anyway. Everything else stays on `Animated`.

### Built so far (2026-11-01, local, uncommitted)

- Shelf unit, cut-out packs (leaning when low), white plates for packs without a cut-out,
  the six signal animations (`PackSignals.tsx`, two moving packs a shelf, each once when its shelf scrolls into view),
  pick it up (`PackQuickView.tsx`), basket → trolley from 9 items, the walk-forward zoom.
- Tuned on the phone: three packs a shelf, packs 1.4× the slot's width tall, small rail labels (price and size on one
  line, two-line name), the + on the pack's foot. Tried four a shelf and two-deep facings; both dropped (crowded, and the
  dark copy didn't read as real).
- The aisles are light like the rest of the app (`aisle-theme.ts`). Dark aisles were tried and dropped on 2026-11-02, as going dark to light at the cart jarred; dark comes back app-wide later, following the system setting. Wooden planks and uprights on a pale back panel, as the first version had (metal rails dropped the same day). The
  bottom bar is one row (the bag, which opens the walk summary, and the next aisle); the brand row uses compact pills.
- Picked up (`HeldPack.tsx`): as big as the room above the sheet allows, a shadow of stacked black copies (a shadow style
  on a cut-out draws a pale box on iOS, and iOS won't blur a tinted image), pinch to zoom 1–3× and double-tap, swipe
  sideways to turn it through the product's gallery photos with dots below. The sheet shows the price line (one size) or
  size chips, and Add turns into − n + without closing.
- Removing with − on the shelf flies the pack out of the basket back onto the shelf.
- Cut-outs: a notch check (outline more than 10% of the pack's size inside its convex hull) sends packs the flood fill
  bit into to the model.
- Not yet: drag to basket and haptics (they need the native libraries and a new dev build); gallery photos as cut-outs
  (a `galleryCutouts` column, flood fill only), held for now. Multiply blend was ruled out: on the dark aisle it darkens
  the whole pack.
- Local test data: `npx tsx prisma/seed-shelf-signals.ts` (demo orders at Sree Ranga Store, since shoppers never see Template Store: a bestseller and trending packs
  in Atta & Flours and Biscuits & Cookies); `--remove` deletes them.

## Phase 2: aisle signals (API)

Built 2026-11-01: each product in `due`, `popular` and `endcap` of `GET /store-walk/:storeId/aisles/:categoryId` carries
`shelf: ShelfSignals` (`services/shelf-signals.ts`, typed in `@martly/shared/types`). Migration
`20261101091000_store_products_created_index` keeps the new-listing check fast.

| Field | Rule |
|---|---|
| `bestseller` | Top 1 in the aisle (top 1 per subcategory once one is picked) by 30-day units, at least 5 units |
| `trending` | 7-day units ≥ 3 and more than 1.5× the 30-day weekly pace |
| `boughtThisWeek` | Distinct shoppers in 7 days; sent only when ≥ 5, so a new store never looks empty |
| `isNew` | Listed in the last 21 days, once the store had been open 21 days, on a day it listed at most 20 products (a stock check or catalog import isn't new arrivals) |
| `stockLevel` | `full` / `half` / `low` from available stock against the product's 30-day units (low = 5 or fewer left) |
| `cutoutUrl` | On the product, from Phase 0 |

Cancelled orders don't count. All of these are org-scoped through the store, like the existing popularity query.

## Phase 4 (parked): fun

Aisle stamps on a walk card, a hidden deal per walk, a receipt printing out of the paper bag on the summary, optional
basket sound (`expo-audio`, off by default).

**Open decisions:** does a stamp card or deal hunt carry a reward, and who funds it (store, Martly, loyalty points)?
Sound in or out?

## Testing

- Phase 0: pilot cut-outs reviewed on the phone (white packs, clear bottles, odd shapes); failure rate recorded here.
- Phase 2 (done 2026-11-01): faked sales in a rolled-back transaction at Template Store's Atta & Flours. 6 shoppers
  this week → bestseller, trending, `boughtThisWeek` 6; 2 sold 20 days ago + 1 this week → nothing; 3 left → `low`;
  listed alone on a quiet day → new; the store's bulk-imported listings → not new. No rows left behind.
- Phase 1, on the phone: the animations play once per shelf and not while scrolling back; Reduce Motion; pick up,
  quick view, drag to basket on a low-end Android; trolley at 9 items; walk-forward zoom; fallback packs without a
  cut-out; Tamil.

## Mockups

https://claude.ai/artifact/HX7Bz8m9CoFV3ujiMUAjf2 (2026-11-01, for review before coding): A the shelf unit with cut-outs,
B packs without a cut-out on white plates plus the end-of-aisle offers, C pick it up, D the six signal animations (Play).
