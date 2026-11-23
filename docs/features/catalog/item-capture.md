# Item Capture

List unbranded household items (steel vessels, tumblers, spoons, buckets, mats) from a phone: guided photos, measured size, approximate volume, AI-written listing and a size sketch.

## Flow

1. Manage → Add product → **Measure an item**.
2. iPhone with LiDAR on iOS 17+: a native camera screen walks through the views one at a time: a progress strip, a card with a drawing of where to stand after each snap, a large symbol for the next move, and one gauge. Tilt steps use a vertical gauge (Top 45–90°, the rest 10–55°). Walking steps use a horizontal gauge (Angled 25–55° from Front, Side 60–120°). Snap stays on for 0.8 s if the aim slips, and always goes off after a shot. Standing items take Top, Front, Angled and Side; flat items take 2 top views. Size is measured from Top, Front and Side; Angled is for the listing.
3. Review screen: photos, size in cm, volume, retake warnings, price each, stock, optional name.
4. **Submit & next** creates a `CatalogDraft` with `kind: ITEM`.
5. The catalog agent worker names and describes the item, picks the aisle, cleans the photos and marks the sizes on one of them. It always goes to the review queue, and goes live only when someone approves it. A listing is used on approval.

Android and phones without LiDAR take normal photos and type the size.

## Size image

The listing shows Front, the size image, Side, then Top (flat items: first top view, size image, second top view). The Angled photo appears only with the marks on it, or plainly if there's no size image. The size image is a cleaned photo with its sizes marked: Ø and H on round items, L, W and H on boxes, L and W on flat items. No AI is involved. Edges come from the non-white pixels, and every number comes from the stored size.

- **Which photo:** the first top view for flat items, and the Angled view for standing ones. Older captures use the Front or Side view, whichever shows more of a box's sides. Lines are parallel to the box's own edges. When a box shows only one side, that side is taken as the length and the width line runs back along the top edge. It's written as text only if the top doesn't show at all.
- **Volume:** the "Show volume on photo" switch on the review screen, off by default, adds a pill such as "~ 450 ml". It only appears on items with a capacity.
- **Clean-up:** items always use `gpt-image-2.5-flare`, never Photoroom, with their own prompt (same shape, same angle, white background, soft shadow). Haiku then compares the render with the original and rejects it only if it looks like a different item (kind of shape, colour, material, parts). Slight changes in proportions or angle pass, so a render can differ a little from the real item, while the numbers always come from the measurement.
- **Fallback:** if that check fails, the item keeps its plain photo. The edges can't be found on a photo with its background, so there's then no size image and the size table on the product page carries the sizes.
- **Corrections:** changing a size redraws the image in place.

## Volume

An estimate from the outer shape (`estimateCapacityMl` in `@martly/shared/item-size`), only for items the AI calls containers. It's rounded to 50 ml below 2 L and 500 ml above, and shown as "About X". A capacity typed by staff wins and shows without "About". Correcting a size later re-estimates an estimated capacity and redraws the sketch.

## Architecture

| Layer | Where |
|-------|-------|
| Native capture (iOS) | `apps/mobile/modules/item-measure/` |
| Maths checks | `modules/item-measure/tools/{synthetic,report,remeasure}.swift` |
| Batch capture | [item-batch-capture.md](item-batch-capture.md) |
| Review screen | `apps/mobile/components/manage/item-capture/`, route `app/manage/item-capture/new.tsx` |
| Size logic | `packages/shared/src/item-size/` |
| Data | `ProductVariant` size fields + `sketchUrl`; `CatalogDraft.kind` + `measurement` |
| AI listing | `apps/api/src/services/catalog-agent/describe-item.ts`, `pipeline.ts` |
| Size image | `apps/api/src/services/item-sketch/` (`size-photo.ts` overlay) |
| Customer display | `apps/mobile/components/ProductSize.tsx`, `apps/web/src/routes/p/$slug.tsx`; the size image is also in the gallery, so older app builds show it |
| Editing sizes | Manage `VariantEditor`, admin `pages/products/ItemSizeFields.tsx` |
| Aisles | `apps/api/prisma/seed-kitchenware-aisles.ts`, then `seed-search-intents.ts` and `taxonomy-images` |

`CatalogDraft.measurement` keeps the phone's reading beside the size staff confirmed. Comparing the two is the calibration data.

## Known limits

- Accuracy is proven on two low, wide items only (within about 3 mm). Tall and large items, handles and flat mode haven't run on real items.
- Glass table tops make items read too tall, because LiDAR sees through the glass.
- If a Top view is more than 3 cm out of line after tracking slips, it's dropped and the app warns. Top views below 55° skip this check.
- The wider angle limits come from a synthetic sweep (worst error about 4.5 mm at a 45° Top view, against 3.4 mm at 75°). Real tracking noise at these limits hasn't been measured.
- Handles count toward the fitted size; staff correct it to the body width.
- Each capture makes its own product. Adding a size to an existing product comes next.
- Each item uses one listing credit. With none free (drafts being worked on or waiting for approval count as using one), Manage locks the capture options and the API refuses a new draft with 402, so no AI runs.

## Verification checklist

- [ ] `swiftc` synthetic test passes (command below)
- [ ] Item draft publishes with name, aisle, size image as second gallery photo, and variant size fields
- [ ] Volume pill appears only with the switch on and a capacity
- [ ] Photoroom failure on an item gives the plain photo and no size image, never an OpenAI render
- [ ] Every item goes to review, with extra reasons if the aisle or name is uncertain
- [ ] Staff from another org are refused
- [ ] Pack drafts behave as before
- [ ] Correcting a size in Manage or admin redraws the size image in place
- [ ] Mobile product page, web product page and admin show the size

## Commands

```bash
# Maths
cd apps/mobile/modules/item-measure
swiftc -O ios/Core/*.swift tools/synthetic.swift -o /tmp/synthetic -parse-as-library && /tmp/synthetic

# Aisles
cd apps/api
npx tsx prisma/seed-kitchenware-aisles.ts && npx tsx prisma/seed-search-intents.ts

# Queue an item
TOKEN=$(curl -s localhost:7001/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"manager@martly.in","password":"manager123"}' | jq -r .data.accessToken)
curl -s localhost:7001/api/v1/catalog-drafts -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "storeId": "66dd70fc-98e0-4120-bf7f-13723eaad571",
  "photos": ["<media url>", "<media url>", "<media url>"],
  "mrp": 250, "sellingPrice": 250, "stock": 5,
  "item": { "shape": "ROUND", "topDiameterMm": 150, "baseDiameterMm": 90, "heightMm": 60 }
}'
```

## Manual verification

Needs a dev build on an iPhone Pro:

- Full flow on a steel item, on a non-glass surface, then check Manage, the customer product page and the web page.
- A tall item, a large bucket, a handled vessel and a flat mat, compared against a ruler.
- The type-it-yourself path on Android or a phone without LiDAR.
- The first real items' cleaned photos, because the clean-up checks were written for pack labels.
