# Label brief for a labelling subagent

You read product packs from a store visitor's phone photos and write one JSON file per product for Martly's master catalogue.
You make no API calls; you look at the photos yourself with the Read tool.

Inputs (paths given in your prompt):
- `RUN/groups.json`: each group is one product: `{ id, photos: [file…], main }`. Only do the ids you were given.
- `RUN/previews/<file>.jpg`: 1536px copies of each photo. Read every photo of a group before writing anything.
- `PHOTOS/<file>`: the full-size originals. If small print (ingredients, nutrition, MRP, net weight, barcode) is unreadable in the
  preview, crop the original into your scratch dir and read the crop, e.g.
  `sips -c 1200 1200 --cropOffset 1500 800 PHOTOS/IMG_1.JPG --out /scratch/crop.jpg` (height width, then y x offset).
  Other agents share the scratchpad: keep crops and helper scripts in a subfolder named after your id list (e.g. `scratch/todo-03/`)
  and give crops the photo's name, so you never read another agent's crop or run its script.
- `RUN/ref/brands.tsv` (id, name) and `RUN/ref/subcategories.tsv` (id, Department > Category > Subcategory). Grep them.
- `RUN/products/IMG_8073.json` style example: follow its shape exactly if one exists.

**Work one product at a time.** Read its photos and write its file at once, before you open the next product's photos.
Older images get dropped from your context ("media removed"). Never write a field from memory of a photo you can no longer
see; Read it again.

## Write `RUN/products/<id>.json`

```json
{ "id": "<id>", "photos": [...same as groups.json], "main": "<same as groups.json>",
  "label": { ... }, "classification": { ... }, "existing": null, "barcodeTaken": false,
  "tamil": { ... }, "shots": [], "usd": 0, "error": null }
```

### label: copy facts exactly as printed; never guess
- `shots`: `[{ index, role }]`, one per photo in order; role is front|back|side|angled|top|nutrition|ingredients|barcode|other.
- `name`: brand + product + key variety as on the pack, without the pack size, e.g. "Heaven Gate Pumpkin Raw Seeds".
- `brand`: the consumer brand on the pack, not the packer/marketer unless that is the only name. null if none.
- `variantName` (e.g. "100g", "1L", "500ml", "10 pcs"), `unitType` (KG|GRAM|LITER|ML|PIECE|PACK|DOZEN|BUNDLE), `unitValue` (number).
- `barcode`: EAN/UPC digits only, and only if every digit is legible. Shop price stickers are not barcodes.
- `printedMrp`: rupees printed or stamped on the pack, else null. A shop's price sticker is not the MRP; mention it in notes.
- `foodType`: VEG|NON_VEG|VEGAN|EGG from the FSSAI dot, null if no mark. `productType`: GROCERY|SNACKS|BEVERAGES|DAIRY|FROZEN|
  FRESH_PRODUCE|BAKERY|PERSONAL_CARE|HOUSEHOLD|BABY_CARE|PET_CARE|OTC_PHARMA.
- `ingredients` (string or null, character for character), `nutrition`: `[{ name, value }]` rows as printed with units, including
  a "Nutrition per" / serving row; [] if none. `allergens`: [].
- `fssaiLicense`, `manufacturerName` (company only), `countryOfOrigin`, `shelfLifeDays` ("best before 12 months" = 365),
  `storageType` (AMBIENT|COOL_DRY|REFRIGERATED|DEEP_CHILLED|FROZEN or null), `storageInstructions`, `usageInstructions`,
  `dangerWarnings`: null when absent.
- `description`: 2-3 factual sentences for a shopper from what the pack says. No invented health claims.
- `tags`: 3-6 lowercase search words a shopper might type.
- `confidence`: `{ name, size, brand }` each high|medium|low. `notes`: anything unclear, contradictory or inferred, else "".
- Leave out batch numbers and packed/expiry dates. Ink-stamped values are often misaligned with their captions: match the stamped
  lines to the captions by order ("100GM / 350/- / 07-2026" under "Net weight / M.R.P. / P.K.D.").

### classification
`{ "brand": { "id", "name" } | null, "brandConfidence", "subcategoryId", "subcategoryPath", "subcategoryConfidence" }`.
- brand: the row of brands.tsv that is the SAME brand (spelling variants fine; a similar-sounding other brand is not). null if
  none matches: publish then creates the brand from `label.brand`.
- subcategory: the single aisle a shopper would look in, copied from subcategories.tsv (id and path). "high" only when clearly right.

### tamil
`{ name, description, ingredients, storageInstructions, usageInstructions, nutrientNames }`, for shoppers in Dharmapuri, Tamil Nadu.
Natural everyday Tamil as a local shopper would say it, not a literal translation. Brand names written in Tamil script, never
translated. Keep sizes, numbers and units as written. null wherever the English is null. Ingredients in the same order, none
added or dropped. `nutrientNames` has exactly one entry per `label.nutrition` row, same order.

## When you hit a problem
- The photos of a group are clearly two different products: write the file for what the main photo shows and put
  "GROUPING: …" at the start of `notes`.
- No brand, no name (loose or own-pack goods): describe what you see, brand null, confidence low, and say so in notes.

## Finish
Run `cd /Users/vaidehi/Projects/martly/apps/api && npx tsx scripts/shelf-photos/session-files.ts --run RUN --check` and fix every
line about your ids (ignore "no label yet" for other ids). Report: ids done, any GROUPING notes, any low-confidence names or sizes.
