# AI collection builder

Collections → Create starts with a **Build with AI** card. An admin describes the collection in a line, and the AI curator drafts it: English and Tamil title and subtitle, in-stock products across the right aisles, and the banner's art direction. The admin edits the draft and saves; the banner can be drawn on save.

## Flow

1. **Brief.** The admin writes a line such as "Rainy-evening snacks and hot drinks". A SUPER_ADMIN also picks the organization whose stores the collection draws from; an ORG_ADMIN uses their own. The form's **Kind** goes along, so a Store special brief is described as the store's own range.
2. **Draft** (`POST /api/v1/collections/ai-draft`, `apps/api/src/routes/collections/ai-draft.ts`). Text only, so no image credits.
   - `orgSubcategoryCandidates` lists the aisles in stock at the org's active stores.
   - `curate(describeBrief(brief, kind), candidates)` (`services/seasonal/curator.ts`) is the festival curator, generalised to take a description. It returns 4–12 aisles, the EN+TA copy and the `imagePrompt`. Festival curation calls the same function through `describeEvent`.
   - `pickProducts` takes up to 16 products: best sellers over 30 days, then deepest stock, interleaved across the aisles.
   - Errors: 400 when a SUPER_ADMIN sends no organization, 422 with the curator's reason when the stores can't support the brief, 503 when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is missing.
3. **Review.** The draft fills the form: title, slug, subtitle, Tamil title and subtitle, products (the drafted ones are added to the select's options so the chips show names), and a hidden `artDirection` and `organizationId`. The admin can change any of it.
4. **Save.** `POST /collections` now accepts `artDirection` and `translations.ta`. When an art direction is set, **Draw the banner when I save** (on by default, 1 image credit) calls the existing `POST /:id/regenerate-banner` after the create, then opens the edit page. A failed drawing still lands on the saved collection, where the AI Banner card can regenerate it.
5. **Afterwards.** Because the collection has an `artDirection`, the edit page shows the AI Banner card with Regenerate. Occasion and Season collections also get the Home Hero card's Generate hero.

Without a brief, the create form works as before.

## Tested

- API and admin typecheck clean.
- `POST /ai-draft` as SUPER_ADMIN without an organization returns 400.
- `POST /collections` with `artDirection` and `translations` stores both, with the products and organization.
- **Admin, in a headless browser, with the draft response mocked:**
  - The draft fills the title, slug, subtitle, Tamil fields and product chips, and shows the art direction with the banner checkbox.
  - Save creates the collection with its art direction, Tamil copy and organization, calls regenerate-banner, and opens the edit page.
- The live draft couldn't run locally: the local `ANTHROPIC_API_KEY` is rejected as invalid.

## Needs manual verification

- With a valid Anthropic key, draft "rainy evening snacks and tea" for Demo Grocers: sensible aisles and products, natural Tamil copy.
- A brief the catalog can't support (e.g. "car spare parts") shows the 422 reason.
- Save with the banner on: the banner appears on the edit page and the org's image credits drop by 1.
- An ORG_ADMIN sees no organization picker, and their draft uses their own stores.
- The Tamil title shows on the app's collection screen with Tamil selected.
