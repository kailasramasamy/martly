# Shelf-photo import

Turns phone photos of packs missing from the catalog into master-catalog products listed at chosen stores. Everything stays
in a local run folder until a person approves it. Scripts are in `apps/api/scripts/shelf-photos/`.

## Without the Claude API (default since 2026-11-24)

Every script takes `--no-claude`. The reading, grouping, labelling, Tamil and render checks are then done in a Claude Code session,
and only the OpenAI renders are paid for. `session-files.ts` writes the brand and aisle lists, splits the work and validates what
the session wrote. The step-by-step is the `shelf-photo-import` skill (`.claude/skills/shelf-photo-import/`). Images must be
transparent: `process.ts` rejects renders with a solid or white backdrop, and `publish.ts` holds any product with an opaque image.

## Flow

1. `group.ts` reads each photo with Haiku and proposes which consecutive photos are one product.
2. `review-server.ts` (localhost:7003) `/` lets a person correct the groups.
3. `process.ts` reads the label, checks the barcode, picks brand and category, writes Tamil, renders a transparent image of
   every photo with `gpt-image-2.5-flare`, and has Haiku compare each render to its photo. Resumable, capped by `--max-usd`.
4. `hide-stamps.py` hides MRP, batch, packing and expiry details, locally: macOS Vision (`ocr.swift`) finds the text and the
   block is filled with its surrounding colour. Reads `run/rendered`, writes `run/final` and `run/hidden.json`.
5. `/approve` shows each product. Prices are prefilled from the label; approving saves to `run/decisions.json` only.
6. `publish.ts` uploads `run/final` images and creates the master product, with Tamil and `cutoutUrl` set to the main image,
   listed at PSB and Sree Ranga at stock 0. Writes `run/fix-list.json` for the second pass.

## Limits

- Renders change small print: 328 of 423 images failed the check in the first run. Failures don't block; they go on the fix list.
- Hiding misses dot-matrix stamps it can't read, and printed price badges on fronts. A spot check of 12 hidden images found
  leftovers on about half, and patches on busy backgrounds can look smeared.
- `publish.ts` never changes a product it already created, so correcting a price after publishing is done in the admin panel.
- Products with no category or no image are held and reported. New brands need `generate-search-intents.ts` and
  `seed-search-intents.ts` re-run for search ranking.

## Tested (local DB, 2026-11-03)

Three products published to master with both store listings, correct price and stock 0, and Tamil saved; the image served from
the CDN and a store's product API returned the listing. A re-run made no duplicates. Test rows were then removed.

## Needs manual verification

- `/approve` clicked through in a browser.
- A real batch on prod, then the products checked in the app.

## Review page features and the fix pass

- MRP is prefilled from the photos (`read-mrp.ts`, close-ups from `crop-mrp.py`); conflicting reads are flagged on the page.
- Name, size, prices, ingredients and nutrition can be edited. Nutrition can be pasted as free text; Haiku tidies it into rows on save, and nothing saves if it can't be read.
- Save, approve later holds a product. Each image has a comment box, and originals open in a zoom and pan pop-up.
- `process.ts --fix-comments` renders commented photos again following the comment and moves the old files to `run/before-fix`. Then run `hide-stamps.py` without `--force`, which only redoes those images.
- Publish translates an edited name, ingredients and nutrition into Tamil again, and strips a pasted "Ingredients:" prefix.
- Two photos of one pack share a barcode, so the second is treated as already in the catalog.

## Known limits

- Renders still change small text. The verifier fails most images, and `run/fix-list.json` lists them for the second pass.
- Local hiding misses dot-matrix stamps and details sharing a line with kept text such as "Net Wt". Those need a hand patch or a new render.
