---
name: shelf-photo-import
description: Turn a folder of store/shelf photos of packs into Martly master-catalog products listed at stores - group photos into products, read labels, pick brand and aisle, Tamil, transparent cut-outs, approval page, publish to prod. Use when the user hands over a folder of product photos (e.g. from PSB) to add to the catalog.
---

# Shelf-photo import (no Claude API)

Scripts: `apps/api/scripts/shelf-photos/`. Background and limits: `docs/shelf-photo-import.md`.

**Rule: no Anthropic API calls.** All reading, grouping, labelling, Tamil and render checks happen in this Claude Code session
(subagents on Sonnet for the photo reading). The only paid API is OpenAI image renders (`gpt-image-2.5-flare`). Every script runs
with `--no-claude`. Never run a script without it.

Set `PHOTOS` (the user's folder), `RUN` = `${PHOTOS}-run`, and run everything from `apps/api`.
Ask the user once: which stores and what stock (last batches: 30). Since 2026-11-26 PSB lists by hand on aisle walks, so publish to Sree Ranga only unless told otherwise. Publish goes to **prod**.

## 1. Group

1. `npx tsx scripts/shelf-photos/group.ts --no-claude --photos $PHOTOS --run $RUN` makes `RUN/previews/` and lists the photos
   that still need a read. Videos are skipped.
2. Fan out Sonnet subagents of about 25 photos each. Each one reads `RUN/previews/<file>.jpg` and writes `RUN/reads/<file>.json`
   (the original name, e.g. `IMG_1.JPG.json`). Tell them to **write each file right after viewing that photo**: a subagent's
   older images get dropped ("media removed: request limit"). On 2026-11-24, agents given about 53 photos each wrote their
   first 10–20 reads from memory, and those had to be read again.
   Each file has this shape:
   `{ isProduct, role: front|back|side|top_bottom|other, brand|null, product|null (no size), size|null, barcode|null (all digits legible), look (<12 words: colours/shape) }`.
3. Run group.ts again. It writes `RUN/grouping-table.tsv`. Read the table yourself and write `RUN/ranges.json`
   `{ "groups": [{ first, last, confidence, note }] }` by the GROUP_SYSTEM rules in group.ts: photos of one product are
   consecutive, and a new product starts when brand, variety or size changes. Use medium/low and a note for judgement calls.
4. Run group.ts a third time. That writes `groups.json`.
5. `npx tsx scripts/shelf-photos/review-server.ts --no-claude --run $RUN --photos $PHOTOS`, then the user fixes the groups at
   http://localhost:7003/. List the low-confidence groups for them.

## 2. Labels, brand, aisle, Tamil

1. `npx tsx scripts/shelf-photos/session-files.ts --run $RUN --refs` writes `ref/brands.tsv` and `ref/subcategories.tsv` from prod.
2. `session-files.ts --run $RUN --todo 14` splits the unlabelled groups into id lists of about 12 products (more products per agent and photos drop out of its context).
3. One Sonnet subagent per list, briefed to follow [label-brief.md](label-brief.md) with RUN, PHOTOS and its ids. They write
   `RUN/products/<id>.json`.
4. `session-files.ts --run $RUN --check` must report every product valid. Collect the agents' notes on duplicates, GROUPING
   problems and low-confidence names, for the approval step.
5. Normalise brands across the batch before rendering: one spelling per brand, and the same shared barcode never on two products
   (null it). publish.ts matches a new brand to any master brand of the same name, so a different maker with the same name
   (New Hope "Milka" cakes vs Milka chocolate) needs a distinct name, e.g. "Milka Wonder Cake".

## 3. Render (OpenAI only)

`npx tsx scripts/shelf-photos/process.ts --no-claude --run $RUN --max-usd 20` checks barcodes against prod and renders every
photo. A barcode already in the master catalog means no render. Shots are saved with verdict `unchecked`. It runs about $0.035
a photo. Check free disk space first.

Then check the renders in the session. `session-files.ts --run $RUN --pairs` writes one side-by-side image per render
(photo | render on magenta) to `RUN/pairs/`. Split the product ids across Sonnet subagents, about 50 photos each, briefed with
[render-check-brief.md](render-check-brief.md). They set each shot's `verdict` and `differences` in `products/<id>.json`.

Fix pass, before the user sees anything: `session-files.ts --run $RUN --comments` writes `comments.json` for failed shots with
a halo and for failed main images. Then `process.ts --no-claude --fix-comments --run $RUN` (about $0.035 a shot), `--pairs`
again, and one more render check of the new `unchecked` shots. If a second render is worse, restore the first one from
`before-fix/rendered-<image>`. Other failures, mostly garbled back-panel small print, go on the fix list and don't block.

What the 2026-11-24 batch showed (412 renders, 217 failed): a halo re-render worked 3/3, and a garbled main image improved
8/28. **Never ask the render to remove a shop price sticker.** That worked 3/30; the rest invented Tamil lines, fake store ovals
or barcode digits where the sticker was. The first render, sticker and all, was restored for those.

**Every image must be a transparent cut-out. The user asks for this every batch.** `process.ts` rejects a render that comes back
solid or keeps a white backdrop round the pack. `publish.ts` holds any product whose final image has opaque canvas corners.
When checking renders, flatten each one onto a coloured background (e.g. magenta) to spot leftover haze, stool or shelf
edges, and record them as a `fail`.

## 4. Hide stamps (local)

`python3 scripts/shelf-photos/hide-stamps.py --run $RUN` (macOS Vision OCR; writes `final/` and `hidden.json`).

## 5. Approve

Restart review-server with `--no-claude`; the user approves at http://localhost:7003/approve. Pasted nutrition must be
`name: amount` per line. Comments on images → `process.ts --no-claude --fix-comments --run $RUN`, then hide-stamps again.

## 6. Publish (prod)

1. `npx tsx scripts/shelf-photos/publish.ts --no-claude --prod --dry-run --stock 30 --run $RUN`. publish.ts finds existing
   products by SKU or barcode only, so search prod master products by name for every "would create" with no barcode. For a
   match, set its decision to `rejected` and list the existing variant at the stores yourself (insert into `store_products`).
2. If it writes `RUN/tamil-edits-todo.json` (reviewer edited a name/ingredients/nutrition), translate each entry in the session
   into `RUN/tamil-edits.json`: `{ "<id>": { name|null, ingredients|null, nutrientNames: [...] } }`, the same rules as the brief.
3. Run it without `--dry-run`. New brands need a search-ranking score, but `generate-search-intents.ts` calls the Anthropic API,
   so don't run it. List the prod brands missing from `prisma/data/brand-popularity.json`, write their 0–100 scores yourself
   (the POPULARITY_PROMPT scale in that script), then run `DATABASE_URL=<PROD_DATABASE_URL> npx tsx prisma/seed-search-intents.ts`.
   Products with no printed MRP stay undecided until the user types a price. Publish again once they have; already-published
   ones are skipped.
4. Update the shelf-photo-import memory with the batch, the run folder, the SKU range and what's held.
