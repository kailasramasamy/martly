# Paid Marketing (store plans, brand campaigns, brand portal)

Banners and AI promotions are paid. Store owners buy a monthly plan (plus top-ups) and advertise in their own stores; brands pay much more to run campaigns across every store that stocks them.

## Who buys what

| Buyer | Package | Shown where |
|---|---|---|
| Store owner | **Plan**: Free ₹0 (0 promotions, 0 AI images), Growth ₹999/mo (2 promotions, 2 AI images), Pro ₹2,499/mo (6 promotions, 6 AI images, push) | Only that owner's stores |
| Store owner | **Annual billing** (2 months free): Growth ₹9,990/year (₹833/month), Pro ₹24,990/year (₹2,083/month); allowances still reset monthly | Only that owner's stores |
| Store owner | **Extra promotion** ₹599 (never expires; sold only on Growth/Pro) | Only that owner's stores |
| Store owner | **14-day Growth trial**, once per organisation, free | Only that owner's stores |
| Brand | **Brand banner** ₹7,500/week (home carousel) | Every store that stocks the brand |
| Brand | **Category takeover** ₹4,500/week (top of one category) | Every store that stocks the brand |
| Brand | **Brand promotion** ₹15,000/week (discount on the brand's products + home banner) | Every organisation that takes part |
| Brand | **Brand views** ₹200 per 1,000 views (off until enabled) | Every store that stocks the brand, until the views are delivered |

All prices are seed values plus GST, editable in **Admin → Marketing → Ad pricing** (super admin). Edits apply to new purchases only: orders snapshot the price.

## A promotion is one banner

A store's only marketing object is the **promotion**: one banner in the home carousel that opens a target, optionally with a discount on that target's products. There are no standalone banners and no banner slots.

- **Every promotion uses one promotion** from the plan (or a bought extra), whether AI or manual. It is charged when the promotion is created, refunded automatically if the AI fails; reopening an ended one is another run and uses another.
- **AI promotion**: write a brief ("paneer 5%"); the agent picks the products, discount, English/Tamil copy and paints the banner (included). A ready AI promotion can be redrafted twice for free.
- **Manual promotion**: pick what it opens/covers (department/category/subcategory, product, collection, brand, search or link), an optional discount (aisles, products, collections and brands only; capped by the org's discount cap), duration, launch now / save as Ready / schedule (`launchAt`), and the banner image.
- **Banner image**: upload (free; requirements shown in the UI, `BANNER_IMAGE_REQUIREMENTS`) or **Generate with AI**, which uses one of the month's AI images (Growth 2, Pro 6). While a promotion is Ready or Live its image can be replaced, regenerated with AI, or its wording edited.
- AI banners pick a layout and style the store hasn't used in its last few banners, with extra-bold headlines spanning the banner; when no description is given they picture the promotion's target.
- Launching switches the banner on and applies the discount; ending switches it off and restores prices. Every live promotion shows in the carousel (only brand campaigns are capped per placement).

## Store owner flow

1. **Marketing plan** (admin web or the Manage app): plan in force, promotions left this month (+ extras), AI images left, push, plan cards.
2. **Trial**: an organisation that never had a plan can start a free 14-day Growth trial (2 promotions, 2 AI images) from the Marketing plan page. Upgrading out of it starts the paid plan now (the trial carries nothing).
3. **Auto-renew**: plans are Razorpay subscriptions (UPI AutoPay or card mandate) billed monthly at price + GST. Billing details first (name, optional GSTIN, address, state). An upgrade replaces the running subscription now and carries the unused value of the old plan as extra days; the same or a cheaper plan authorises its mandate now and is first charged when the current month (or trial) ends. Every charge (checkout handler or `subscription.charged` webhook, whichever arrives first) creates one GST invoice and one month. **Cancel auto-renew** keeps the plan until the end of the paid month; buying it again turns renewal back on from then. A failing renewal (`subscription.halted`) notifies the owners. No "plan ends in 3 days" reminder is sent while a plan renews itself.
4. **Annual billing**: a Monthly / Annual toggle on the plan cards (Annual shows the monthly equivalent and the yearly bill). An annual charge (yearly Razorpay plan) grants 365 days, but promotions and AI images reset every 30 days within it. Whether a change is an upgrade is judged by price per day (Growth monthly → Growth annual waits for the paid month; annual Pro from monthly Growth starts now), and the unused value of the running plan, as actually paid, carries over.
5. **Extra promotions** (₹599) can be bought only while a paid plan (not the trial) is in force, so a plan is always the cheaper way to get promotions.
6. **Promotions → New**: AI or Manual (both show "Uses 1 promotion · N left").
7. **Expiry**: with no paid period covering today the organisation is on Free; promotions already running finish their run. Owners get a reminder 3 days before a plan ends unless the next month is paid.
8. **Results**: per promotion — views, taps and tap rate of its banner, and orders/units/revenue on its products while it ran.
9. **Brand ads**: owners can switch brand ads off, block brands (default: nothing blocked) and opt out of a scheduled brand promotion. Blocking hides every banner of that brand immediately.

## Brand flow

1. Martly team (Admin → Brand campaigns) or the brand itself (Brand portal, `BRAND_PARTNER` login) books a campaign: package, weeks (or thousands of views), start date, category (takeovers), copy, creative (upload, or AI from a brief), discount (promotions), optional target stores.
2. **Availability**: brand campaigns per placement at once (Ad pricing → Home carousel limits; default hero 2, category top 1 per category, mid page 1). Unpaid bookings hold their slot for 2 days, then lapse.
3. **Payment**: Razorpay checkout (brand portal) or a recorded bank transfer (Martly team). Paid → **In review**.
4. **Review**: Martly approves (needs an image) → **Scheduled**, or rejects → refunded (Razorpay refund API; transfers refunded by hand).
5. **Go live** (scheduler, every 5 min):
   - Banners/takeovers/views → one network banner, shown only in stores that list the brand, whose organisation allows brand ads and hasn't blocked the brand (and in the target stores, if chosen). Labelled "Sponsored" in the app.
   - Brand promotion → one promo per participating organisation (allows brand ads, no block, didn't opt out, stocks the brand) with up to 20 of the brand's products at the campaign discount; prices revert when it ends.
6. **Reports**: views/taps/CTR and brand orders per store; for promotions a **claims CSV** per store (units sold on offer and discount given) for the brand to reimburse stores directly. Martly takes no revenue share.

## Payments & invoices

- Amounts always come from the server-side `AdOrder`, never the client.
- In-app verify (`POST …/verify`) and the Razorpay webhook (`POST /api/v1/payments/webhooks/razorpay`, event `order.paid`, secret `RAZORPAY_WEBHOOK_SECRET`) both call one idempotent fulfilment, so a payment is never granted twice and still completes if the app closes mid-payment.
- GST tax invoices (SAC 998365) numbered per financial year (`MKT/2026-27/0001`), CGST+SGST when the buyer is in the seller's state, otherwise IGST. Opened from a 15-minute signed link and printed/saved as PDF from the browser.

## Architecture

- **Models**: `AdProduct` (price list), `MarketingConfig` (GST, brand campaign limits per placement, seller, redrafts), `AdOrder`, `MarketingInvoiceCounter`, `OrgPlanPeriod`, `PromotionCreditEntry` (credit ledger; `fromPlan` separates plan allowance from bought top-ups), `BannerStatDaily`, `OrgBrandBlock`, `BrandCampaign`, `BrandCampaignOptOut`, `BannerArtRun`; new fields on `Organization` (billing, `allowBrandAds`), `Banner` (`sponsorType`, `brandId`, `targetStoreIds`, `viewCap`, `viewsServed`, `brandCampaignId`), `Promo` (`kind` AI/MANUAL, `actionType`/`actionTarget`, `launchAt`, `chargedFrom`, `regenerations`, `uploadedImageUrl`, `brandCampaignId`; its one banner via `Banner.promoId`), `User.brandId`, role `BRAND_PARTNER`.
- **Services**: `services/marketing/*` (entitlements, billing, invoice, stats, renewals, banner-feed, banner-image, target-scene, config), `services/promo/*` (lifecycle, manual, targets, draft, view), `services/brand-campaigns/*` (booking, go-live, reports, art), `services/seasonal/banner-design.ts`.
- **Routes**: `/marketing/*` (owner), `/marketing-admin/*` (super admin), `/brand-campaigns/*` (super admin), `/brand-portal/*` (brand partner), `/payments/webhooks/razorpay`, `/promos/manual`, `/promos/generate-image`, `/promos/:id/banner` (+ `/generate`), `/promos/:id/regenerate`, and for shoppers `/banners/by-placement/:storeId` and `/banners/events`.
- **Scheduler**: `plugins/marketing-scheduler.ts` — plan expiry, renewal reminders, campaign start/end, lapsing unpaid bookings.
- **Feed**: home and by-placement banners go through `storeBanners()` (scope, dates, brand targeting, view caps, brand caps per placement).

## Setup

1. Migrations `20261017115900_paid_marketing_enum_values` … `20261017140000_banner_art_runs` (deployed by `migrate deploy` on API start).
2. `cd apps/api && npx tsx prisma/seed-ad-pricing.ts` (only creates missing packages; never overwrites edited prices).
3. Razorpay dashboard: switch on **Subscriptions** (test and live), then Webhooks → `https://<api>/api/v1/payments/webhooks/razorpay` with events `order.paid`, `subscription.charged`, `subscription.activated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`; put the secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Ad pricing page: fill in seller GSTIN and address for invoices.

## What was tested

- `scripts/marketing-selftest.ts` (local only; uses up invoice numbers): Free refuses promotions; Growth gives 2 (AI or manual) then refuses; top-up used after plan; refunds idempotent; months queue; upgrade carries ~12 days and moves the queued month; on expiry a running promotion keeps its banner.
- curl: manual 5% Cow Ghee promotion uses 1 of 6 and discounts 399 listings; banner wording edit and AI regeneration (uses 1 AI image); old /banners admin routes 404; free-plan 402s; billing profile required; Razorpay test order ₹1,178.82 for Growth; bad signature rejected; valid verify → PAID with invoice `MKT/…`, CGST/SGST 9% each; webhook replay doesn't double-grant; webhook with bad signature → 401.
- Brand: slot cap refuses a third hero booking; online payment (IGST for Gujarat billing, ₹8,850), offline transfer, review, cancel; go-live creates the network banner and a per-org promo (333 listings discounted); feed shows store + brand banners within caps; block/allow-off hides brand banners; events → results (40 views, 3 taps, 7.5% CTR); ending restores all prices; claims CSV; brand partner sees only their brand (404 for others, 403 on platform endpoints).
- AI art: three banners for one store came out in three different layouts and styles with large bold headlines.

## Needs manual verification

- Razorpay checkout end to end with real test cards/UPI (orders and subscription mandates) in the admin web app and the mobile app; only signatures and webhooks were simulated, because Subscriptions is not yet enabled on the Razorpay account (its plans API returns 401).
- The webhook from the real Razorpay dashboard on the deployed API.
- Invoice look in print/PDF.
- Mobile: banner view/tap counts appearing after browsing; "Sponsored" label; plan purchase flow in the Manage app.
- Prod OpenAI key: the API process must load `apps/api/.env`'s key (the shell's `OPENAI_API_KEY` has no credits).
