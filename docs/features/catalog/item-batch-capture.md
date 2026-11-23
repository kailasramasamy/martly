# Batch Item Capture

Measure many unbranded items in a row at a shop and list them later from the Mac. It's the same guided LiDAR capture as [Item Capture](item-capture.md), without the review screen, upload or AI on the phone.

## Flow

1. Manage → Add product → **Batch capture**. This only shows for SUPER_ADMIN, on an iPhone with LiDAR running iOS 17+.
2. Pick the store, then **Start capturing**. The guided camera takes Top/Front/Angled/Side, or the two top views for flat items.
3. A price card shows the measured size and any retake warnings. Type the price, then:
   - **Another size**: saves the item, and the next capture is another size of the same item (same `groupId`).
   - **Next item**: saves the item and starts a new one.
   - **Discard and retake**: deletes this capture.
4. The batch list shows every item, newest first, with its photo, size, price and any "Check size" flag. Sizes of one item share a teal edge. Rows can be removed.
5. **Export** zips the batch and opens the share sheet. AirDrop it to the Mac. Once the zip is sent, the app offers to clear the batch from the phone. Keep it until the zip has arrived.

One batch is on the phone at a time, and it survives closing the app.

## On the phone

`Documents/item-batches/<batchId>/`:

| File | What |
|------|------|
| `batch.json` | `{ version: 1, batchId, storeId, storeName, createdAt, items: [{ itemId, groupId, price, flat, capturedAt, reading, photoCount }] }` |
| `<itemId>/capture.json` | Saved frames (intrinsics, pose, mask and depth sizes), table height, the phone's `reading` |
| `<itemId>/mask_N.bin`, `depth_N.bin`, `conf_N.bin` | Raw views used for measuring (Angled isn't measured) |
| `<itemId>/photo_N.jpg` | All photos in capture order: Top, Front, Angled, Side, or two Top views when flat |

The manifest keeps ids only. The app's folder moves between installs, so photo paths are built from `batchRoot()` each time.

## On the Mac

```bash
cd apps/api
npx tsx scripts/item-batch/index.ts ~/Downloads/martly-batch-xxxxxxxx.zip --dry-run   # table only
npx tsx scripts/item-batch/index.ts ~/Downloads/martly-batch-xxxxxxxx.zip --prod      # queue drafts on prod
```

1. Unzips into `~/Martly/item-batches/<batchId>/`. Bundles are kept there as calibration data.
2. Re-measures every item with `tools/remeasure.swift`, which uses the same `ios/Core` code as the phone. It prints phone vs Mac sizes and flags differences over 5 mm, Mac errors and phone warnings.
3. Uploads the photos the way `POST /uploads` does and creates one `CatalogDraft` per item (`kind: ITEM`, created by the first SUPER_ADMIN or `--user`). The catalog agent worker then names the item, assigns its aisle, cleans the photos and makes the size image, as for any item draft.
4. `processed.json` maps item to draft, so a rerun skips items already queued. `report.json` holds each item's group, draft, both readings and flags.

Review then happens in the draft queue (Manage or admin), or from a contact sheet built in a Claude session from `report.json`.

## Shared code

`measureShots` (iOS) is now a thin wrapper: the maths lives in `ios/Core/Reading.swift` (`readItem`), and the bundle format in `ios/Core/CaptureFile.swift`. Both compile on the phone and the Mac, so a Mac reading is the phone's reading re-run with the current code.

## Tested

- `swiftc` synthetic suite, including a new bundle round trip (write → read → re-measure gives the same size): passes.
- Mac script on a synthetic three-item batch: the dry-run table and the 10 mm flag show; a run against the local DB created three QUEUED ITEM drafts with the right measurement; a rerun created none.
- Mobile `tsc`: clean.

## Needs manual verification

- [ ] A real batch on the iPhone: capture, price card, Another size grouping, restart the app mid-batch, remove an item
- [ ] Export: the zip AirDrops and unzips with `<batchId>/batch.json` at the top
- [ ] `--prod` run on that zip; the drafts process and publish as size images
- [ ] Phone vs Mac readings agree on real bundles (they should be identical)

## Not yet

- Sizes in a group still publish as separate products. Publishing a group as one product with several sizes needs `CatalogDraft.groupId` and approval changes (phase 3).
