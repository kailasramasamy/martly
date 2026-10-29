# Store plans, promotions and the banner cap

What a store pays for, as shown on martlyshop.in/for-stores/pricing (prices in `apps/web/src/lib/pricing.ts`),
and how the app enforces it. Store owners never see image counts, image packs or the word "AI".

## Plans

| Plan | Price | Promotions | Customer notifications |
|---|---|---|---|
| Free | ₹0 | 0 | No |
| Growth | ₹999 a month, ₹9,990 a year | 2 a month | Yes |
| Pro | ₹2,499 a month, ₹24,990 a year | 6 a month | Yes |

- Plans are `AdProduct` rows of kind `STORE_PLAN` (`prisma/seed-ad-pricing.ts`; the seed only creates missing rows, so prod is updated by SQL).
- Listings: catalog products are free; each plan lists the store's own or local products free up to `OWN_LISTINGS_INCLUDED` (Free 10, Growth 25, Pro 50, counted once), then ₹100 each, one-time (`LISTING_FEE`, in `@martly/shared/constants`). Every own product created (admin `POST /products` by an org user, or a catalog draft published by approval or the agent) takes one listing in the same transaction (`services/marketing/listing-credits.ts`, `ListingCreditEntry`): the plan's free ones first, then bought ones (`LISTING_TOPUP`, ₹100, any plan, never expire). With none left the create/approve answers 402 and the agent leaves the draft in review. Deleting an own product gives its listing back. Entitlements return `listings: { included, used, planLeft, extraBalance }`.
- An extra promotion (`PROMO_TOPUP`) is ₹599 on any plan, Free included, and never expires. On Free it runs without customer notifications.
- Order commission (2% cash and wallet, 4% online) is in `docs/store-ledger.md`.

## Onboarding plan

- A store's launch (`launchStore()` in `services/onboarding/launch.ts`, used by `POST /onboarding/:storeId/launch` and `scripts/onboard-store.ts`) gives the organisation **90 days of Growth** when it has never had a plan period.
- The period has no order and isn't a trial, so extra promotions can be bought and an upgrade carries the unused days.
- The self-serve 14-day trial is gone. `getEntitlements().trial` is always `{ available: false }` so app builds from before this change hide their trial card.

## Promotions

- One promotion is one request: the owner types or says what they want. `POST /promos` from a store user always sets `autoLaunch` and `notify`, so the agent drafts it and it goes live by itself (see `docs/promo-agent.md`). Martly's team still chooses both.
- The promotion credit pays for everything, including the banners the agent paints (English and Tamil).
- Manual promotions stay in the API for Martly's team and older app builds; the owner screens no longer offer them.

## Banner cap

Banners an owner asks for outside promotions (a new promo banner, collection banners, festival heroes, Home tiles) are free
but limited by a hidden monthly cap, `MarketingConfig.ownerBannerCap` (default 60, editable as "Banners per store per month" on the pricing settings).

- `withAiImages()` in `services/marketing/ai-images.ts` counts the banners before painting under a per-org lock, and gives them back if painting fails.
- Past the cap the API returns 402 `AI_IMAGES_EXHAUSTED`: "You've made a lot of banners this month. Ask Martly to help."
- The count resets every 30 days of a plan period, or each IST calendar month on Free.
- `AiImageCreditEntry` stays the ledger (`fromPlan = true` for every row). SUPER_ADMIN is never counted.
- Image packs (`AI_IMAGE_PACK`) are no longer sold: the products are inactive and orders refuse them.

| Action | Route | Banners |
|---|---|---|
| New promo banner | `POST /promos/generate-image`, `POST /promos/:id/banner/generate` | 1 |
| Collection banner | `POST /collections/:id/regenerate-banner` | 1 |
| Festival hero | `POST /collections/:id/regenerate-hero` | 7 reserved; unpainted ones given back |
| Home tile art | `POST /home-layout/:id/art` | 1 per tile; failed tiles given back |

## Migration

`20261029090000_owner_banner_cap` adds `marketing_config.owner_banner_cap`. Plan rows were updated by SQL: Growth gets `push_included`, new descriptions, packs set inactive.

## Martly's per-store settings (beta stores)

Platform admins set these per organisation from the Plans list (admin Marketing → Revenue, app Platform → Revenue → Plans):

- **Always on martlyshop.in** (`Organization.webStoreAlwaysOn`): `webStoreWhere` keeps the org's live stores on the website whatever plan it's on.
- **Unlimited own products** (`Organization.unlimitedListings`): `chargeListing` never refuses; listings still count against the plan, and bought listings aren't spent.
- **Give a plan**: Growth or Pro for 1–730 days, starting now, with no order behind it (`POST /marketing-admin/organizations/:id/plan`). It wins over a running plan while it lasts.

Sree Ranga and PSB (beta stores) have both switches on and a year of Pro.

## Tested

- Self-test (`scripts/marketing-selftest.ts`, 21 checks): Free lists 10 then 402; a bought listing is used next; deleting gives it back; Growth raises the allowance to 25.


`scripts/marketing-selftest.ts` (local DB) passes all checks, including: no trial offered; a first launch gives 90 days of Growth with notifications and extras; a second store's launch adds nothing; the banner cap allows 60 then returns 402.
Curl as a store owner: entitlements show Growth with push, no packs listed, a pack order is refused (404), `POST /marketing/trial` is gone (404), Free with no extras gets "Buy an extra promotion, or upgrade", and a request sent with `autoLaunch: false, notify: false` is saved with both on.

## Needs manual checks

- A real request on prod drafts, goes live by itself and sends one notification.
- The owner screens in admin and the next mobile build show no image counts, packs, trial or "AI".
