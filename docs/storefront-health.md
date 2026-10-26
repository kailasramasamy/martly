# Storefront health

Shows how rich a store's app looks, explains each feature in plain English and Tamil, walks the owner through turning features on (with AI drafts the owner approves), and measures what shoppers actually use.

## Flow

1. **Tracking.** The customer app reports Home section events to `POST /home/events`:
   - views, once per section per session
   - taps
   - cart adds

   They're stored as daily rows in `home_section_stats_daily`. A cart item added inside a section carries `source { sectionId, sectionType }`. Checkout sends it, and it's saved on `order_items.source_section_id/_type`, so sales can be credited to Home rows. Old app builds send nothing; every field is optional.
2. **Health.** `GET /storefront/health?storeId[&fresh]` runs 24 checks in 5 groups:
   - Shop looks
   - Home screen
   - Deals
   - Fresh content
   - Service & loyalty

   Checks are defined in `packages/shared/src/constants/storefront.ts` (weight, title/what/why in en+ta, Manage screen, admin path, AI action) and computed in `apps/api/src/services/storefront/checks/*`.
   - Home checks judge the way the Home screen does (`sectionVisibility`, `heroCardReadiness`), so "on" means shoppers really see it.
   - Score = earned weight ÷ weight of the checks that apply (NA excluded), out of 100.
   - Suggestions = OFF / PARTIAL / STALE checks ranked by points gained.
   - Deal checks get ×1.3 when deal rows drive ≥25% of Home cart adds.
   - A live banner with ≥200 views and <0.5% taps over 14 days is flagged "not working".
   - Results are cached for 60s. Each compute upserts today's `storefront_health_snapshots` row, which feeds the trend. `plugins/storefront-health-scheduler.ts` refreshes every active store every 6 hours.
3. **What's working.** `GET /storefront/effectiveness?storeId&days=7|30` reports:
   - per-section views / taps / CTR / cart adds / orders / revenue
   - Buy X get Y and discount sales
   - coupon redemptions
   - banner taps
   - share of revenue from Home
4. **AI drafts.** `POST /storefront/ai/{branding,post,offer-picks}` with `{storeId}` returns a draft and saves nothing.
   - **branding:** tagline (en + ta) and 3 English highlight chips, from the store's departments and delivery (Haiku).
   - **post:** a "New in store" or "Fresh today" shop post with its products and a Tamil version (Haiku).
   - **offer-picks:** well-stocked listings with no offer and no sales in 30 days, split into Buy 2 Get 1 and 10% off (SQL, no model).
   - With no Anthropic key or a failed call, it returns 503 "AI drafting isn't available right now".
5. **Stores list.** `GET /storefront/stores` lists active stores weakest first, with group scores and the week's change. An org admin sees their own stores; a super admin sees all.

All endpoints need `MARKETING_MANAGE` (resource `storefront`) and access to the store.

## Screens

**Mobile Manage**
- **Today → Your storefront card:**
  - score, the "awning" (one stripe per group, filled to its score) and the week's change
  - the top 3 suggestions
  - "Walk me through it"
- **More → Marketing → Storefront health** (`/manage/storefront`):
  - **Health:** every check by group with status and what it does. Tap a missing one to open the guide at it, or an "on" one to open its screen.
  - **What's working:** 7 / 30 days.
- **Guide** (`/manage/storefront/guide`):
  - one suggestion at a time: what it is, why it matters, points gained
  - **Do it with AI**, **Set it up myself** or **Skip**
  - when the owner comes back from a screen, finished steps drop out
- **Do it with AI** opens the normal form, filled in:
  - Branding: `/manage/storefront/branding?ai=1`, a new screen for logo (trimmed), cover, tagline (+Tamil), highlights, posters and brand colour.
  - Post: `/manage/store-posts/new?ai=1`
  - Offers: `/manage/offers/new?ai=BUY_GET|DISCOUNT`
  - Promotions: the promo agent.

**Admin**
- Marketing → Storefront health: stores by score.
- The detail page shows suggestions with "Draft with AI" (apply / publish / start buttons), all checks, and what's working.

## Tested

- Service level against Sree Ranga:
  - Health came out at 43/100: missing banners, coupon, discounts, post, cover, tagline and highlights; hero carousel on with 3 of 5 cards ready.
  - Template Store came out at 91 and Kaveri Fresh at 22.
- Effectiveness returns banner stats; sections stay empty until the new app build sends events.
- Branding draft gives a short tagline in good Tamil and 2–3 word chips. The post draft gives a natural Tamil post. Offer picks returned 6 + 6 listings.
- `POST /home/events` writes daily rows.
- API, admin and mobile typecheck.

## Needs manual verification

- Phone screens: Today card, Storefront (both tabs), guide, branding save, and the AI pre-fills for post and offers.
- Admin list/detail in the browser, including the Apply / Publish / Start buttons.
- An order placed from a Home row has `order_items.source_section_id` set (needs the new app build; there's no OTA).
- Hero cards screen and AI collection card on the phone (add, remove, Right now pickers, brief → draft → save → card on Home).
- Festival collection still uses "Set it up" only: a festival collection hangs off the festival, which the AI builder doesn't pick.

## Hero cards

- The health target is 4 ready cards (`STOREFRONT_MIN.HERO_CARDS`); Home still shows the carousel from 2 (`HERO_MIN_CARDS`).
- `heroCardReadiness` returns each card with `ready`, its `collectionId` and collection title. `HERO_CARD_GUIDE` (shared) gives each kind's plain name, what it needs (en + ta) and where it's fixed.
- The guide's hero step lists every card: a tick, or what it needs with a "Set up" link (offers, store specials AI, a collection).
- **Hero cards** (`/manage/storefront/hero-cards`, also "Edit hero cards" on the Home layout section): cards in order with status, remove a card, the four "Right now" collections, and add a card (a self-filling one that was left out, or a collection in one of 7 colours). Saves the section's `config` through `PATCH /home-layout/:id`, customising the default layout first if needed.
- **AI collection card** (`/manage/storefront/hero-ai`, "Do it with AI" on the hero and store specials steps): brief → `POST /collections/ai-draft` → owner edits the words (en + ta), products and colour → `POST /collections` → the card is added to the carousel. A store special adds the Store special card if it's missing.
- The draft now returns a slug nobody has taken (slugs are unique across organizations).
- A brief is curated narrowly: only the aisles it names (an item without its own aisle takes the one it's shelved in, e.g. podi → Chutney), from 2 aisles; festivals still need 4. A store special puts the org's own products, its local brands and unbranded goods first.
- The store special hero card shows product rows like the other cards, with the collection photo (or a shop icon) as its badge.
- Creating or patching a hero section checks every card and Right now collection belongs to the organization (or is global).
- Admin shows the per-card list under the hero check.

## Feature pictures

The guide shows each feature as shoppers see it: a whole phone screen from Template Store, with the feature outlined in amber and the rest dimmed.
- **Files:** `apps/mobile/assets/storefront/*.webp`, mapped to checks in `components/manage/storefront/previews.ts`.
- **Coverage:** 20 of 24 checks.
  - Posters reuse the cover picture, since they swipe in the same spot.
  - Reviews shows the empty Reviews block for now, because no store has reviews yet.
  - No picture yet for:
    - Home sections with enough products (not one spot)
    - New products (no single spot)
    - Loyalty and Referral (both off at Template Store)
- **Retaking after a design change:** take the phone screenshot, then outline the feature's box and dim the rest at 540px wide, as WebP.
