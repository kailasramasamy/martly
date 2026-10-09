# Taxonomy Images

Transparent, photorealistic cut-out images for departments and categories, generated with OpenAI `gpt-image-1.5` in one locked style.

## Flow

1. **Subjects** — `apps/api/scripts/taxonomy-images/subjects.json` maps `level → slug → what to show`. Only generic, unbranded items (no text, logos or labels).
2. **Generate** — `cd apps/api && npx tsx scripts/taxonomy-images/generate.ts --level department|category [--only a,b] [--quality medium|high] [--force]`
   - Shared style prompt lives in `generate.ts` (`STYLE`); change it there, not per subject.
   - Output (gitignored): `scripts/taxonomy-images/out/<level>/<slug>.png` (1024 master), `.webp` (512, used in app), `raw/`, and `out/contact.html` review sheet (app tile / white / dark).
   - Skips slugs already generated; re-run after failures to fill gaps. `--force` regenerates.
   - Medium quality is ~1/3 the cost of high and indistinguishable at tile size (~$0.05/image).
3. **Review** — open `out/contact.html`. Fix the subject text for any bad image and regenerate with `--only <slug> --force`.
4. **Publish** — `cd apps/api && npx tsx prisma/seed-taxonomy-images.ts` uploads to S3 as `taxonomy/<level>/<slug>-<hash>.webp` (immutable cache headers; the hash changes when the image does) and sets `imageUrl` by slug. For prod, prefix with `DATABASE_URL=<prod url>`.

## Gotchas

- `generate.ts` loads `.env` with `override: true` because `~/.zshrc` exports a different `OPENAI_API_KEY` with no credits.
- `gpt-image-2` does not support transparent backgrounds; stay on `gpt-image-1.5`.
- Avoid all-white subjects (towels, diapers, soap) — they vanish on the teal tile. Ask for pastel colours.

## What was tested (2026-10-09)

- 16 departments + 87 categories generated, reviewed, 6 regenerated (baby-care, bath-body, diapers-wipes, milk, sweets-mithai, rice).
- Uploaded to S3 (200, `image/webp`, immutable cache), seeded local and prod; prod `GET /api/v1/categories/tree` returns new URLs for 16/16 departments and 87/87 categories.

## Manual verification

- Mobile: home category tiles, Categories tab department cards, category screen.
- Admin: Categories list thumbnails.

## Next

- Subcategories (447): add a `subcategory` key to `subjects.json`, extend `LEVELS` in both scripts.
