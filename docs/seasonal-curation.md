# Seasonal Curation Agent

Builds festival and season collections, plus their hero banners, for each organization without anyone having to create them by hand.

## Flow

1. **Festival calendar** (`festival_events`, admin → Marketing → Festival Calendar) is the source of truth for dates. Each event has:
   - kind (OCCASION or SEASON)
   - dates (IST days)
   - `leadDays`: how many days before the festival shopping starts
   - regions: `ALL` or state codes
   - `guidance`: hints for the curator, such as "vegetarian"
2. **Org regions** (`organizations.festival_regions`, set on the admin organization edit page) decide which events apply. An event applies when its regions include `ALL` or overlap the org's regions.
3. **Scheduler** (`plugins/seasonal-curation-scheduler.ts`, daily at 06:00 IST, plus once 5 minutes after startup in production) finds (org, event) pairs whose go-live date (`startsAt − leadDays`) is within `REVIEW_DAYS` (7) and that have no collection yet. It runs only when both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are set.
4. **Curation** (`services/seasonal/`):
   - `candidates.ts`: lists the subcategories in stock at any active store of the org.
   - `curator.ts`: Claude Sonnet 5.5 (`claude-sonnet-5-5`, structured output, server-side refusal fallback) picks 4–12 subcategories and writes the English and Tamil title and subtitle plus an art-direction prompt. It may skip the event if the catalog can't support it. IDs are checked against the candidate list.
   - `pickProducts`: takes the top 3 per subcategory, ranked by 30-day org sales then stock, interleaved, up to 16 products.
   - `banner-art.ts`: generates the image with OpenAI `gpt-image-2.5-flare` (override with `OPENAI_IMAGE_MODEL`) at medium quality, 1536×1024, as WebP at compression 80 (about 180 KB). It's uploaded to S3 at `banners/seasonal/`, using the shared `services/media.ts` helper.
   - `hero.ts`: designs and paints the festive home hero alongside the banner (see [festive-home-hero.md](festive-home-hero.md)).
   - `index.ts`: creates a `Collection` with `source=AGENT`, `festivalEventId`, `translations.ta`, window `[startsAt − leadDays, endsAt]`, and its hero tiles. Since 2026-10-14 it no longer creates a `HERO_CAROUSEL` `Banner`; the hero replaces the carousel while the festival is live.
5. **Review window:** drafts show as "Scheduled" in Collections, with an "AI-curated" tag, for about 7 days before they go live.
   - **Veto:** turn the collection off. Its banner turns off with it (`PUT /collections/:id` keeps the banner in sync). The unique `(organizationId, festivalEventId)` constraint stops the agent from recreating it.
   - **Regenerate:** delete the collection. Its banner is deleted too, and the next run (or **Curate now**) builds a fresh one.
6. **Surfaces:**
   - Search landing (`OccasionSpotlight`): shows the art as the card header and the Tamil copy when the app language is `ta`.
   - Home: the hero carousel shows the banner, and the collection appears as a home rail.

Manual trigger: `POST /api/v1/festival-events/:id/curate`, the **Curate now** button. ORG_ADMIN runs it for their own org, SUPER_ADMIN for every matching org. It is idempotent.

Seed: `cd apps/api && npx tsx prisma/seed-festival-calendar.ts` loads 15 national and Tamil Nadu events for Oct 2026 – Oct 2027. Dates were checked against Drik Panchang; Ramzan is tentative on the moon sighting.

## What was tested (local DB synced from prod, Demo Grocers)

- Migrations applied, calendar seeded, and the org opted into `ALL + TN`.
- `findDueCurations` on 2026-10-13 returns Diwali (goes live Oct 17) and Northeast Monsoon, which is correct.
- Real curation runs:
  - **Karthigai Deepam:** 16 products (agal vilakku, lamp oil, wicks, camphor, ghee, sesame oil, ball jaggery, aval, kolam powder…), natural Tamil copy, window Nov 17 – Nov 24 IST. The art shows lamps, pori urundai, appam and adai, with empty space on the left.
  - **Diwali:** sweets, savouries, ghee, diyas, gift packs and dry fruits, with no non-veg items. The WebP is 182 KB.
- A second curate returns `exists`, both via the script and `POST /:id/curate`.
- Veto: `isActive:false` on the collection turns its banner off, and reactivating restores both.
- With the Diwali window moved temporarily to the past:
  - `GET /search/landing` returned the occasion with `imageUrl` and `translations`.
  - `GET /home/:storeId` returned the agent banner in `HERO_CAROUSEL` and the collection with `kind`.
  - The window was then restored.
- Typecheck: API, admin and shared are clean. Mobile has no new errors; the 20 errors that remain were already there.

## Needs manual verification

- Mobile: open the search landing with a live agent collection. Check the art header, gradient legibility, and the Tamil copy (switch the app language to Tamil). Check the hero slide on home.
- Admin: Festival Calendar list, create and edit, Curate now (takes about 60–90 s), and the inline veto switch on Collections.
- Prod: set `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` on Railway, apply both migrations (`20261013000000_search_landing`, `20261013010000_festival_calendar`), and run the calendar seed.
