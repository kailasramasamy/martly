# Store packs

Many stores pack loose staples (dal, rice, sugar) in their own printed pouches. Martly shows each store's real pack without adding a product per store. Every product gets one photo of a blank clear pouch filled with it. Every store gets a pack design: its artwork plus the places where product text goes. The server prints the artwork onto the photo and caches the result.

## How it works

- **`Product.packPhotoUrl`** holds the blank pouch photo, filled with the product, on a **transparent background** like our catalog images. Renders keep that transparency and add a soft drop shadow plus a contact shadow, so the pack looks photographed on any card colour. Every photo made for one template has the same pouch shape, so any store's artwork lines up. Templates are listed in `PACK_TEMPLATES` (`apps/api/src/services/pack-render/templates.ts`). Today there is only `pillow-1kg-full`.
- **`PackDesign`** belongs to one store. It holds the front and back artwork (transparent PNGs), its template, and its **zones**. Zones are the places where product text is drawn: the Tamil and English names, the net weight (from `variant.name`), the ingredients and the nutrition table. The **MRP is never printed**, because stores change prices.
- **Which design applies:** a design listed for the product's subcategory wins. Otherwise the store's default design is used. Only products with a pouch photo get a pack.
- **Rendering** happens in `services/pack-render`:
  - The product's text is drawn into the zones with the fonts bundled in `apps/api/assets/fonts`.
  - The result is warped onto the pouch photo, clipped to the bag outline, and given the photo's lighting and the film's gloss.
  - The back is printed onto the front photo mirrored, until a real back photo exists.
- **Caching:** `plugins/pack-images.ts` refreshes every 5 minutes and at startup. A refresh renders only packs whose inputs changed and uploads them to `pack-renders/{designId}/{variantId}/{side}-{hash}.webp` on the CDN. The hash covers the design, the photo and every printed field, so a product edit shows up within 5 minutes.
- **Serving:**
  - A `preSerialization` hook rewrites every store listing in API responses. A listing is any object with `storeId` + `variantId`; its `product.imageUrl`, `product.images` and `variant.imageUrl` become that store's pack. Existing app builds show packs without an update.
  - `GET /products/:id?storeId=` does the same for the product page gallery: front then back for each pack size. The app sends `storeId` from the next mobile build onward.
  - **martlyshop.in** builds its own cards (`services/web-shop/cards.ts`), which the hook can't see, so they read `storePack()` directly. Each `WebPack` carries its pack's front as `imageUrl`, and the card shows the pack of the size picked (it opens on the first size in stock). The product page gallery is the store's packs, front then back for each size.

## Sree Ranga (first store)

- `scripts/store-pack/sreeranga/build.py` redraws their green toor dal pack from photos of the real pack.
- **Which staples:** `apps/api/prisma/data/store-pack-staples.json` lists 168 of Sree Ranga's loose staples. That's every dry staple except oils, ghee and honey (11), which a clear pouch can't show. Each entry gives:
  - the AI description of what fills the pouch;
  - the short ingredients line, which has one line on the label;
  - standard per-100g values (IFCT 2017, USDA where IFCT has none). It is `null` for a few vathals with no published values, which leaves the table blank.
- **Photos:** `scripts/store-pack/gen-staples.mjs` makes each photo as an AI edit of the toor dal photo, so the pouch outline stays within 0.5% and one template fits all of them. The photos aren't in git. The seed uploads them to `pack-photos/` on the CDN.
- **Seed:** `apps/api/prisma/seed-pack-designs.ts` uploads the design as the store's default and puts the photos on the products. It fills ingredients and nutrition only where they're empty.

```sh
python3 scripts/store-pack/sreeranga/build.py "$PWD/scripts/store-pack/sreeranga/out"
node scripts/store-pack/gen-staples.mjs                                  # only makes missing photos
cd apps/api && npx tsx prisma/seed-pack-designs.ts sreerangastore --photos   # add --prod for PROD_DATABASE_URL
```

## PSB Store (second store, front only)

The design went live on prod on 2026-10-28. PSB's packs are clear pouches with orange bands at the top and bottom
and a clear wave window, printed on the front only, so the design has no back artwork.

- `scripts/store-pack/psb/build.mjs` draws the bands and the "Packed by" address. The address is copied from
  `photo-bottom.jpg`, and the net weight goes in the white circle.
- The logo, `pack-logo.png`, was lifted from a close-up of the print (`photo-logo.png`): the white print was separated
  from the orange by colour, then upscaled 4x with Real-ESRGAN, smoothed, and given a redrawn ®.
- `rice-mark.png` is cropped from the same logo, for the small mark before "PSB GRAINS".

```sh
node scripts/store-pack/psb/build.mjs scripts/store-pack/psb/out
cd apps/api && npx tsx prisma/seed-pack-designs.ts psbstore --prod
```

## A new store's pack

1. Get photos of the real pack: the whole front, close-ups of the logo and the small print, and the back if it's printed.
2. Draw the artwork in `scripts/store-pack/<store>/build.mjs`:
   - The canvas is 1252×1528, the whole bag face of `pillow-1kg-full`.
   - Anything left transparent shows the clear film.
   - Lay a grid over the photo to place the bands and curves.
3. Lift logos from close-ups rather than tracing them by hand. Run `/clean-logo`, or separate the print by colour when
   it sits on a solid band.
4. Preview with the production renderer on real pouch photos, and check the result against the photo:
   `cd apps/api && npx tsx scripts/pack-preview.ts <artwork.png> <zones.json> <out dir> "1 kg" <packPhotoUrl>…`
5. Add the store to `DESIGNS` in `prisma/seed-pack-designs.ts`, then run it with the store slug and `--prod`. The API
   renders the packs within 5 minutes.

## Tested (local API, prod-synced DB)

- 500g and 1kg render with the right net weight on the front and back. The MRP is blank. Long Tamil names wrap onto two lines. Nutrition rows are in label order. The background is transparent, with the shadow only under and around the bag.
- `GET /stores/{sreeRanga}/products?productId=…` and store search return pack images. Template Store, which lists the same products, keeps the catalog photo.
- `GET /products/{id}?storeId={sreeRanga}` returns the front and back for each pack size. Without `storeId` it returns the catalog photos.
- Renders are served from CloudFront as WebP.

## Manual checks

- In the app, open Sree Ranga and check:
  - category and search cards
  - the size picker (500g / 1kg)
  - the cart
  - the product page gallery (needs the next mobile build)
- Search suggestions and category tiles keep the catalog photo on purpose: they stand for the category, not one store's product.

## Not done yet

- Owner upload of artwork and assigning designs to subcategories (Manage screen).
- A real back photo with the centre seal strip.
- Bigger pouch templates for 5kg+ sizes. Rice, atta and sugar at 5kg/10kg/25kg print on the 1kg pouch today.
- Bottle and jar templates for oils, ghee and honey.
- martlyshop.in product pages.
