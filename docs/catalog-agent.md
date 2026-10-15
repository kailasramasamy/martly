# Catalog Agent

Store managers add new products by photographing them. They take up to 8 shots, enter the MRP, selling price and (optionally) stock, then tap Submit and move on to the next product. A background agent reads the label, cleans up the photos, chooses the brand and aisle, and lists the product in that store. If it isn't sure about something, it holds the product for review.

## Flow

1. **Capture.** In the mobile Manage persona, open Add products, then the capture screen. Each photo uploads through `POST /uploads` as soon as it's taken. Submit calls `POST /catalog-drafts`, which creates a `QUEUED` draft for the selected store. Roles allowed: SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER.
2. **Worker.** `plugins/catalog-agent-worker.ts` polls every 5 s and works on 2 drafts at a time. It claims a draft with `FOR UPDATE SKIP LOCKED`, so several API instances can run without taking the same draft. A draft left `PROCESSING` for more than 10 minutes (for example, cut off by a restart) goes back to the queue, and the shots that were already processed are kept. If a draft fails twice it becomes `FAILED`, and Retry from the review screen requeues it.
3. **Pipeline** (`services/catalog-agent/pipeline.ts`):
   1. **Read the label.** `extract.ts` makes one Claude Haiku 5.5 call over all the *original* photos and returns structured output: the role of each shot, name, brand, size, EAN, printed MRP, veg mark, ingredients, nutrition, FSSAI number, manufacturer, shelf life, storage, description, tags, and a confidence for each key field. The result is saved on the draft, so a requeued run doesn't read the label again.
   2. **EAN match.** If the barcode already belongs to a master or same-org variant, the agent only lists that variant in the store (`PUBLISHED`, `matchedExisting`). If the store already sells it, the draft becomes `DUPLICATE`. This path makes no image calls. If the barcode belongs to another organisation's product, the new variant is created without a barcode and the draft is held for review.
   3. **Brand and aisle.** `match.ts` uses pg_trgm `similarity()` to find the 5 closest brands. Then one Haiku call picks the brand from those candidates and the subcategory from the full aisle list. The aisle list is a numbered, prompt-cached system block.
   4. **Photos.** `images.ts` processes each shot once, 4 at a time:
      - With `CATALOG_IMAGE_PROVIDER=openai` (the default), `gpt-image-2.5-flare` makes a medium-quality 1024² render. Haiku then compares the render with the original photo. `pass` and `minor_only` (slogans or tiny text changed) keep the render. `fail` means a claim, number, brand, ingredient or fill level changed, so the agent uses a plain cleanup of the original instead (rotate, normalise, white square). There are no retries.
      - With `CATALOG_IMAGE_PROVIDER=photoroom` (`photoroom.ts`), a low-resolution Remove Background cut-out ($0.02) is used to measure how far the pack leans. Leans of 1–15° are rotated upright; bigger angles are treated as deliberate. Then the Image Editing v2 call ($0.10) applies a white background, AI relighting and a short, light AI shadow (`shadow.intensityOverride` 0.45, `spreadOverride` short, using the `pr-ai-shadows-model-version: 2026-04-15` header). Photoroom never redraws the label, so no check runs. That's about $0.12 per shot, and it needs `PHOTOROOM_API_KEY` on a paid plan: the free trial allows 10 images.
      - Shots taken from above can't be corrected after the fact (Photoroom only offers perspective correction on Enterprise plans, for rectangular items), so the capture screen tells staff to hold the phone level with the pack.
   5. **Decide** (`reviewReasons`). The product auto-publishes only when all of these hold:
      - The name and size were read with high confidence.
      - An existing brand matched with high confidence.
      - The aisle was chosen with high confidence.
      - The printed MRP is either absent or equal to the entered MRP.
      - The barcode doesn't belong to another organisation's product.

      Otherwise the draft goes to `NEEDS_REVIEW` with readable reasons.
   6. **Publish** (`publish.ts`). One transaction creates:
      - an org-owned `Product` with the extracted fields, the front image and the gallery
      - one `ProductVariant` with the MRP, EAN and SKU `CD-<draft id prefix>`
      - a `StoreProduct` with the selling price and stock

      The existing DB trigger fills `search_text`. A conditional status update guards against a draft being approved twice.
4. **Review.** Available in the mobile review screen and in the admin (Inventory > Catalog agent). It shows each original shot next to the processed one, with the Haiku verdict and its differences, plus the extracted facts, the AI's picks and the cost. The reviewer can edit any field, choose a brand or create the new brand the label shows, choose the aisle, then Approve & publish (`POST /:id/approve`). Discard and Retry are also there. A new brand is only created on approval.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/catalog-drafts` | `{ storeId, photos[1..8], hintName?, mrp, sellingPrice ≤ mrp, stock? }`. Photos must be URLs from `/uploads`, which prevents server-side fetches of arbitrary URLs. |
| GET | `/api/v1/catalog-drafts` | `page, pageSize, storeId?, status?`. Store managers only see the stores they're assigned to. |
| GET | `/api/v1/catalog-drafts/:id` | Detail: shots, label, picks, usage |
| POST | `/api/v1/catalog-drafts/:id/approve` | `NEEDS_REVIEW` only. Optional edits: name, description, brandId or newBrandName, subcategoryId, variantName, unitType, unitValue, foodType, mrp, sellingPrice, stock |
| POST | `/api/v1/catalog-drafts/:id/retry` | `FAILED` only |
| POST | `/api/v1/catalog-drafts/:id/discard` | `QUEUED`, `NEEDS_REVIEW` or `FAILED` |

## Cost

Every step adds `{ step, model, inputTokens, outputTokens, usd }` to `catalog_drafts.usage`. List and detail show the total as `costUsd`. Haiku is billed at list price. The flare figures use gpt-image-1's per-token rates as an estimate, so check the OpenAI usage page for the real price.

Measured on a 3-shot jar (2026-10-15):

| Step | Tokens | USD |
|---|---|---|
| Extract | 7.7K in, 2.7K out | 0.0021 |
| Classify (first call, writes the cache) | 15K in | 0.0020 |
| Render ×3 | 1.4K in, 0.4K out each | 0.0304 each |
| Verify ×3 | 3.7K in, 0.6–1.1K out each | ~0.0008 each |
| **Total** | | **~$0.098** |

At 8 shots, a product costs about $0.25. An EAN match to an existing product costs about $0.002, because only the label read runs.

## Environment

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`: required.
- `CATALOG_IMAGE_PROVIDER`: `openai` (default) or `photoroom`.
- `CATALOG_IMAGE_MODEL`: defaults to `gpt-image-2.5-flare`.
- `PHOTOROOM_API_KEY`: required when the provider is `photoroom`.

## Seed and test

```bash
cd apps/api
npx tsx prisma/seed-manage-users.ts      # manager@harur.dev / manager123
npx tsx prisma/seed-catalog-drafts.ts    # queues prisma/data/catalog-agent-sample/* for Harur Fresh Mart (spends ~$0.10)
```

To add a sample, create a folder of JPEGs under `prisma/data/catalog-agent-sample/`, with the front shot first in name order. Then add its prices to `PRICES` in the seed script.

## What was tested (2026-10-15, local)

- **Real run on the pumpkin-seed jar.** It ended in `NEEDS_REVIEW` with two reasons: "Pack size is unclear" and a new brand, Heaven Gate. The aisle was correctly chosen as Grocery & Staples > Dry Fruits & Nuts > Seeds with high confidence. The FSSAI number, veg mark, 12-month shelf life, packer name and nutrition rows were read. The front render passed the check (only the slogan changed). The two back renders failed and fell back to plain cleanup: one had invented cardamom pods, the other a garbled date.
- **Approve** with `newBrandName` and edited MRP and price. This created the brand, an org-owned product with the extracted fields and 3 images, the variant (100g, MRP 350, SKU `CD-…`) and a Harur Fresh Mart listing at ₹329 with stock 12. A second approve returned 409.
- **EAN match.** A barcode the store already lists became `DUPLICATE`. A barcode missing from another store created that listing at the entered price. Neither made any AI calls.
- **Stale recovery.** A `PROCESSING` draft claimed 11 minutes earlier was requeued and finished.
- **Validation and access.** Non-`/uploads` photo URLs, price above MRP, and an approve with price above MRP all return 400. STAFF gets 403, a store the manager isn't assigned to gets 403, and retrying a draft that isn't `FAILED` gets 409.

## Needs manual verification

- The mobile capture flow on a phone: camera loop, background uploads, instant reset, queue auto-refresh, review and approve.
- The admin list and show pages in a browser, including dark mode, brand search and the aisle Cascader.
- Real-world accuracy across more packs (pouches, boxes, bottles, packs with a readable EAN). Watch how often renders fail the check and how often drafts land in review, and switch `CATALOG_IMAGE_PROVIDER` if the renders aren't good enough.
- The prod rollout: apply migration `20261015120000_catalog_drafts`, and set `PHOTOROOM_API_KEY` on Railway if Photoroom will be used.
