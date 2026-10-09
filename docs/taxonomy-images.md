# Taxonomy Images

Transparent, photorealistic cut-out images for departments, categories and subcategories, generated with OpenAI in one locked style.

## Flow

1. **Subjects** — `apps/api/scripts/taxonomy-images/subjects.json` maps `level → slug → what to show`. Only generic, unbranded items (no text, logos or labels).
2. **Generate** — `cd apps/api && npx tsx scripts/taxonomy-images/generate.ts --level department|category|subcategory [--only a,b] [--quality medium|high] [--force]`
   - Shared style prompt and model live in `generate.ts` (`STYLE`, `MODEL`); change them there, not per subject.
   - Output (gitignored): `scripts/taxonomy-images/out/<level>/<slug>.png` (1024 master), `.webp` (512, used in app), `raw/` (untouched OpenAI PNG), and `out/contact.html` review sheet (app tile / white / dark).
   - Skips slugs already generated; re-run after failures (e.g. out of credits) to fill gaps. `--force` regenerates.
   - Medium quality is indistinguishable from high at tile size (~$0.02–0.05/image).
3. **Review** — open `out/contact.html`. Also check transparency programmatically: the model occasionally returns an opaque or hazy background (alpha 0 on < 25% of pixels). Fix the subject text for any bad image and regenerate with `--only <slug> --force`.
4. **Publish** — `cd apps/api && npx tsx prisma/seed-taxonomy-images.ts` uploads every level to S3 as `taxonomy/<level>/<slug>-<hash>.webp` (immutable cache headers; the hash changes when the image does) and sets `imageUrl` by slug. Idempotent. For prod, prefix with `DATABASE_URL=<prod url>`.

## Models

- Departments + categories: `gpt-image-1.5`. Subcategories: `gpt-image-2.5-flare` (current default — noticeably more photographic). Regenerate departments/categories on 2.5 if the style difference becomes noticeable.
- `gpt-image-2` does not support transparent backgrounds.

## Gotchas

- `generate.ts` loads `.env` with `override: true` because `~/.zshrc` exports a different `OPENAI_API_KEY` with no credits.
- Avoid all-white subjects (towels, diapers, soap) — they vanish on the teal tile. Ask for pastel colours.
- Packaging colours can evoke real brands (red cola can, blue-silver energy can). Specify neutral colours for those.
- `cleaning-tools-supplies-garbage-bags` and `paper-disposables-garbage-bags` are duplicate subcategories — catalog cleanup candidate.

## What was tested (2026-10-09)

- 16 departments + 87 categories + 446 subcategories generated and reviewed; 6 + 8 regenerated (opaque backgrounds, brand-like cans, pale subjects).
- Uploaded to S3 (200, `image/webp`, immutable cache), seeded local and prod; prod `GET /api/v1/categories/tree` returns new URLs for 16/16 departments, 87/87 categories, 446/446 subcategories.

## Manual verification

- Mobile: home category tiles, Categories tab, category screen subcategory sidebar.
- Admin: Categories list thumbnails.
