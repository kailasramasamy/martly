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
node scripts/store-pack/gen-staples.mjs                     # only makes missing photos
cd apps/api && npx tsx prisma/seed-pack-designs.ts          # add --prod for PROD_DATABASE_URL
```

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
