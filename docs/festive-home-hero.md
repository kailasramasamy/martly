# Festive home hero

While a festival or season is live, the top of the mobile home screen becomes a festive hero, and the banner
carousel moves below "Shop by Category": AI artwork hanging off a header tinted to match, a celebratory headline, and a 3-column grid of
themed tiles ("Pooja Needs", "Sweets & Dry Fruits"…). Tapping a tile opens a festival screen with every theme as a
chip and the tile's products below.

## Flow

1. **Curation** (`apps/api/src/services/seasonal/`): `curateEvent` runs `buildHero` in parallel with the search banner.
   - `hero-designer.ts`: Claude (`claude-sonnet-5-5`) groups the org's in-stock subcategories into 6 tiles (3 if the
     catalog is thin), each with 1–4 subcategories, an English and Tamil label and an art prompt. It also writes the
     headline (EN and TA), the background's ornament prompt, the wash colour and the headline colour. Unknown or reused
     subcategories are dropped, and the tiles are trimmed to whole rows.
   - `hero-art.ts`: `gpt-image` paints one 2:3 background (ornament in the top quarter, plain wash below, no text) and
     one transparent-background cluster per tile, trimmed to 512px WebP. The images are uploaded to S3 at
     `banners/seasonal/hero/`.
   - Measured theme: the bottom edge sets `heroTheme.background` and its luminance sets `dark`.
     `ornamentDepth` is how far the ornament hangs over the middle 60% of the art, measured against the wash; the app
     starts the headline there, so every festival's art lays out tightly without manual tuning.
   - Self-checks, so no human review is needed:
     - A background whose ornament covers more than 40% is repainted once, and the shallower of the two is kept.
     - A tile with under 15% transparent pixels (the model ignored the cut-out) is repainted once.
     - A headline colour below 4.5:1 contrast on the measured wash falls back to a safe dark (or white) ink.
   - The result is stored on `Collection` (`heroTitle`, `heroImageUrl`, `heroTheme`, `translations.ta.heroTitle`) and
     in `CollectionTile` rows. The cost is about 7 images (up to ~14 if self-checks repaint) and 1 Claude call per org per festival, taking ~45s.
2. **Home feed**: the `FESTIVE_HERO` section carries `heroes`, up to 3 live OCCASION/SEASON collections that have a
   hero, ranked by `rankFestivals` (`services/festival-rank.ts`):
   - festivals before seasons;
   - then the nearest festival day from the calendar event (`FestivalEvent.startsAt`), where a festival already under
     way counts as today;
   - then the shorter festival, so a one-day festival on its day leads a long one it falls in (on 19 Oct 2026:
     Ayudha Pooja, Navratri, Dussehra).

   A collection is live from its lead date (`startsAt - leadDays`), so festivals in their run-up qualify too. Since
   2026-10-21 the hero shows **only the first** (`MAX_HEROES = 1`) and holds still, so the banner carousel below is the
   one moving thing on Home. The app still supports a swipeable multi-hero carousel with dots if that's raised again;
   the header and status bar take the colours of the slide in view. `hero` (the lead slide) is still sent for released builds, as is `festiveHero` on
   the legacy `GET /home/:storeId`. Search landing ranks its 2 festival rails the same way.

   Tiles whose aisles have nothing in stock at that store are hidden, still keeping whole rows. When no hero
   qualifies, the section is dropped and the banner carousel takes the top of the screen. The banner carousel drops
   any banner that only points at a festival in the hero. Live festivals the hero has no room for appear lower down as
   plain product rows (`OTHER_COLLECTIONS`).
3. **Festival screen**:
   - `GET /festive/:collectionId?storeId=` returns the hero and its tiles. Each tile lists its in-stock
     `subcategories` (id, name, imageUrl, translations) in the tile's order.
   - `GET /festive/:collectionId/tiles/:tileId/products?storeId=&page=&pageSize=` returns in-stock products from the
     tile's subcategories, with each aisle's best sellers (30 days, this store) interleaved. An optional
     `subcategoryId` narrows it to one of the tile's aisles; any other subcategory returns 400.
4. **Admin**: the Collection edit page has a "Home hero" card for OCCASION and SEASON collections. It offers:
   - a preview;
   - editing the headline (EN/TA);
   - editing each tile's labels and subcategories;
   - Regenerate (`POST /collections/:id/regenerate-hero`);
   - Replace any single image with an upload (multipart `file`, max 10 MB): the hero background
     (`PUT /collections/:id/hero/image`), a tile (`PUT /collections/:id/tiles/:tileId/image`), or a search banner
     (`PUT /collections/:id/banner-image/:lang`, where `lang` is `en`/`ta`, or `art` for a text-free banner).
     Uploads go through the same preparation as generated art: the background is cropped to 2:3 from the top and
     re-measured (ornament depth capped at 40%, fade colour, headline contrast); tiles are trimmed to fill the card;
     banners are cropped to 3:2 and kept in step with any legacy banner rows;
   - Remove (`DELETE /collections/:id/hero`).
5. **Backfill**: `npx tsx prisma/backfill-festive-heroes.ts` paints heroes for live and upcoming festival collections
   that don't have one. To target prod, prefix it with `DATABASE_URL=...`.

## Mobile

- `components/home/FestiveHero.tsx` renders the artwork at 2:3 full width. The headline is set in Cinzel Bold
  (`fonts.display`) at `ornamentDepth` and kept within the middle 64% of the screen, clear of side ornaments. The
  tile cards are app-drawn gradients made only from the measured wash: lifted towards white behind the label, the
  wash itself, then deepened 10% under the art, with a 16%-deeper border. They take on each festival's palette at no
  image cost. The tiles rise in with a stagger. At the bottom, the artwork's cut-off edge is blended into the sampled
  wash, which then trails 220pt behind the next sections, fading into the page background.
- `components/home/HomeHeader.tsx` (extracted from the home screen) takes the wash colour as its background when the
  theme is light, so the ornament hangs straight off the search bar.
- `app/festival/[id].tsx` (params `id`, `tile`) shows a themed stack header, the `TileChips` rail, the `AislePills` row
  ("All" plus each aisle with its subcategory image; hidden for single-aisle tiles; parenthetical asides in names are
  dropped) and a paginated `ProductList` grid. Switching tiles resets the pill to "All".

## Tested

- Generated the Navratri hero on the local DB through `POST /collections/:id/regenerate-hero` (34s).
- Backfilled the other 4 live collections with the script. Each came back with a celebratory headline and 6 tiles.
- `PUT /collections/:id/hero` updated the headline and Tamil headline without disturbing the other Tamil copy.
- `GET /home/:storeId` (Harur Fresh Mart) returned `festiveHero` for Navratri with 6 tiles.
- `GET /festive/:id` and the tile-products endpoint returned interleaved aisles and pagination meta. An unknown tile
  returned 404.
- On iPhone: the home hero renders with the tinted header, and the festival screen opens on the tapped tile with that
  chip scrolled into view and highlighted.
- API, admin and mobile typecheck with no new errors.

## Needs manual verification

- The Tamil language setting on the home hero and festival screen. The headline font falls back to the system font
  for Tamil glyphs.
- A store where some tiles have no stock, to confirm rows drop cleanly.
- The admin Home hero card in a browser: preview, tile edits, Regenerate and Remove.
- Android: the tinted header under the status bar (`app/_layout.tsx` sets a white, non-translucent bar).
- The banner carousel at the top once no festival hero is live, and below "Shop by Category" while one is.
