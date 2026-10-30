# Category pack tiles

Category tiles (the Categories tab and Home's category directory, in the app and on martlyshop.in) show two real packs
the store sells, Instamart-style, instead of the category's generic art. Mockup and picks were approved on 2026-10-30.

## How it works

1. **Cutouts.** A product gets a transparent cutout of its pack in `products.pack_cutout_url` (with its width ÷ height in
   `pack_cutout_aspect`). Cutouts are made offline and reviewed by eye:
   - `scripts/pack-cutouts/cut.py <photo> <out.png> [--hull] [--backdrop] [--key] [--xmax n]`, needs the rembg venv.
   - Check each result over a magenta backdrop. Light areas must be solid, no white print may be missing, no props.
   - `npx tsx scripts/pack-cutouts/upload.ts <dir> [--prod]` uploads `<productId>.png` files to
     `catalog/pack-cutouts/` and sets the two columns.
2. **Picks.** `categories.pack_product_ids` lists the packs a category's tile should show, back pack first. It's kept in
   `prisma/data/category-packs.json` and applied by `npx tsx scripts/pack-cutouts/apply-picks.ts [--prod]`.
   A chosen pack may sit in another category's aisle (the Maggi pack on Ready to Eat).
3. **Pairing** (`services/pack-tiles/pick.ts`), per store, only from packs it stocks (active, in stock):
   - First the category's chosen packs that the store has, in order.
   - Then its other cut-out packs in the category, one per brand, best known in the store's region first.
   - The first is the back pack. The front is the next one lying the same way (both flat or both upright), from
     another brand when there is one.
   - With fewer than two, the tile keeps the category's art.
4. **Drawing** (`services/pack-tiles/layout.ts`, `compose.ts`):
   - The pair is drawn with sharp onto a transparent 234 × 252 WebP (3× the app's 78 × 84 art box) and cached in
     `pack_tiles` by its two cutout URLs and `LAYOUT_VERSION`.
   - Upright packs: the back one large, the front one at 76% overlapping its lower right (92% when it's slim beside a
     wide pack), both on the floor, with a little air at the top.
   - Two slim bottles: side by side at the same height.
   - Flat packs: the back one raised so the front one covers its lower part, with no gap between them.
5. **Serving.** `directoryGroups` (app) and `departmentTrees` (web) swap a category's `imageUrl` for its tile. A tile
   not drawn yet is drawn in the background on first request, and the category shows its old art until then. No app
   build is needed; current builds show the new images.

## Changing it

- Recut a pack: upload it again. The file name carries a content hash, so its tiles are redrawn.
- Change a tile's packs: edit `category-packs.json` and run apply-picks.
- Change the layout: edit `layout.ts` and bump `LAYOUT_VERSION`.

## Tested

- Sree Ranga (local, prod data): all 51 picked categories return tiles. They were drawn in the background within
  seconds of the first request, and match the approved mockup.
- Fruits & vegetables and other categories without cutouts keep their art.

## Manual checks

- Categories tab on a phone: tiles fill well, packs aren't cut off, labels line up.
- Another store: it only shows packs it stocks, or the category art.
