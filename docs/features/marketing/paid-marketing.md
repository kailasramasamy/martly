# Paid Marketing (store plans, brand campaigns, brand portal)

Banners and AI promotions are paid. Store owners buy a monthly plan (plus top-ups) and advertise in their own stores; brands pay much more to run campaigns across every store that stocks them.

## Who buys what

| Buyer | Package | Shown where |
|---|---|---|
| Store owner | **Plan**: Free ₹0 (1 banner slot, 2 AI images), Growth ₹999/mo (4 slots, 2 promotions, 10 AI images), Pro ₹2,499/mo (unlimited slots, 6 promotions, 30 AI images, push) | Only that owner's stores |
| Store owner | **Extra promotion** ₹399 (never expires) | Only that owner's stores |
| Brand | **Brand banner** ₹7,500/week (home carousel) | Every store that stocks the brand |
| Brand | **Category takeover** ₹4,500/week (top of one category) | Every store that stocks the brand |
| Brand | **Brand promotion** ₹15,000/week (discount on the brand's products + home banner) | Every organisation that takes part |
| Brand | **Brand views** ₹200 per 1,000 views (off until enabled) | Every store that stocks the brand, until the views are delivered |

All prices are seed values plus 18% GST, editable in **Admin → Marketing → Ad pricing** (super admin). Edits apply to new purchases only: orders snapshot the price.

## Promotions own banners

A **promotion is the only way for a store to put up banners**; a banner on its own never changes prices, which confused owners ("Ghee on sale" with no discount).

- **AI promotion**: write a brief ("paneer 5%"); the agent picks products, discount, English/Tamil copy and paints the banner. Uses a promotion credit, which also covers that launch banner (`slotFree`).
- **Manual promotion**: pick what it opens/covers (department/category/subcategory, product, collection, brand, search or link), an optional discount (only for aisles, products, collections and brands; capped by the org's discount cap), duration, and one or more banners (upload or AI image). Uses no promotion credit; each live banner uses a plan banner slot. Launch now, save as Ready, or schedule (`launchAt`; the promo scheduler launches it).
- **Banners under a promotion**: add more placements (home carousel, category top, mid page…), switch them on/off while live, edit or remove. Launching switches them on (and applies the discount); ending switches them off and restores prices.
- **All banners** (admin/manage): read-only list with results; promotion banners open their promotion. Only the super admin still creates Martly's own global banners there.
- Existing standalone store banners were folded into Manual promotions by migration `20261017150000_promotions_own_banners`.

## Store owner flow

1. **Marketing plan** (admin web or the Manage app) shows the plan in force, usage (banner slots, promotions left, AI images) and plan cards.
2. Owner adds billing details (name, optional GSTIN, address, state) once, then buys. Razorpay checkout opens; the app verifies the signature and the plan starts.
   - Same or cheaper plan bought while one is running → queues after it.
   - Upgrade → starts now; the unused value of the old plan is carried over as extra days at the new price; queued months move back.
3. **Promotions**: creating one takes a credit *before* the AI runs (plan allowance first, then extra promotions). If drafting fails on our side the credit is refunded automatically. A ready promotion can be redrafted twice for free. Reopening a finished promotion is a new run and takes a credit. Push notifications are only sent on plans that include push.
4. **Banners**: each active, unexpired store banner uses a slot, except an AI promotion's own launch banner. Going live with more banners than the plan's slots returns 402.
5. **Images**: every banner/promotion image can be **uploaded** or **generated with AI**. Uploads are re-encoded to WebP ≤1600px and cached forever.
   - Upload requirements (shown in the UI, `BANNER_IMAGE_REQUIREMENTS`): landscape 3:2, at least 1200×800 (1800×1200 sharpest), JPG/PNG/WebP up to 5 MB, text and logos in the middle 80%, large bold high-contrast text of about 8 words at most, no borders/phone frames/QR codes/changeable prices.
   - AI banners pick a layout (headline-top, centre-stage, colour panels, poster, flat-lay frame, diagonal band, bottom band) and a visual style (studio colour, overhead natural, 3D render, flat vector, paper collage, festive Indian, pastel minimal, moody dark) that the owner hasn't used in their last few banners, with extra-bold headlines spanning most of the banner. Plain-banner AI images count against the plan's monthly allowance.
6. **Expiry**: when no paid period covers today the organisation is on Free; banners beyond Free's slot are switched off (oldest kept) and the owner is notified. Owners get a reminder 3 days before a plan ends unless the next month is already paid.
7. **Results**: views, taps and tap rate per banner (last 30 days) and, for promotions, orders/units/revenue on the promoted products while it ran.
8. **Brand ads**: owners can switch brand ads off, block specific brands (default: nothing blocked) and opt out of a scheduled brand promotion. Blocking hides every banner of that brand immediately.

## Brand flow

1. Martly team (Admin → Brand campaigns) or the brand itself (Brand portal, `BRAND_PARTNER` login) books a campaign: package, weeks (or thousands of views), start date, category (takeovers), copy, creative (upload, or AI from a brief), discount (promotions), optional target stores.
2. **Availability**: per-placement brand slot caps (Ad pricing → Slot limits, default hero 2, category top 1 per category, mid page 1). Unpaid bookings hold their slot for 2 days, then lapse.
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

- **Models**: `AdProduct` (price list), `MarketingConfig` (GST, slot limits, seller, redrafts), `AdOrder`, `MarketingInvoiceCounter`, `OrgPlanPeriod`, `PromotionCreditEntry` (credit ledger; `fromPlan` separates plan allowance from bought top-ups), `BannerStatDaily`, `OrgBrandBlock`, `BrandCampaign`, `BrandCampaignOptOut`, `BannerArtRun`; new fields on `Organization` (billing, `allowBrandAds`), `Banner` (`sponsorType`, `brandId`, `targetStoreIds`, `viewCap`, `viewsServed`, `brandCampaignId`), `Promo` (`chargedFrom`, `regenerations`, `uploadedImageUrl`, `brandCampaignId`), `User.brandId`, role `BRAND_PARTNER`.
- **Services**: `services/marketing/*` (entitlements, billing, invoice, stats, renewals, banner-feed, banner-image, config), `services/brand-campaigns/*` (booking, go-live, reports, art), `services/seasonal/banner-design.ts`.
- **Routes**: `/marketing/*` (owner), `/marketing-admin/*` (super admin), `/brand-campaigns/*` (super admin), `/brand-portal/*` (brand partner), `/payments/webhooks/razorpay`, `/banners/events`, `/banners/generate-image`, `/promos/:id/regenerate`.
- **Scheduler**: `plugins/marketing-scheduler.ts` — plan expiry, renewal reminders, campaign start/end, lapsing unpaid bookings.
- **Feed**: home and by-placement banners go through `storeBanners()` (scope, dates, brand targeting, view caps, slot caps).

## Setup

1. Migrations `20261017115900_paid_marketing_enum_values` … `20261017140000_banner_art_runs` (deployed by `migrate deploy` on API start).
2. `cd apps/api && npx tsx prisma/seed-ad-pricing.ts` (only creates missing packages; never overwrites edited prices).
3. Razorpay dashboard → Webhooks → `https://<api>/api/v1/payments/webhooks/razorpay`, event `order.paid`; put the secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Ad pricing page: fill in seller GSTIN and address for invoices.

## What was tested

- `scripts/marketing-selftest.ts` (local only; uses up invoice numbers): Free refuses promos; Growth gives 2 then refuses; top-up used after plan; refunds idempotent for plan and top-up credits; months queue; upgrade carries ~12 days and moves the queued month; expiry switches off banners beyond Free's slot.
- curl: free-plan 402s for banners and promos; billing profile required; Razorpay test order ₹1,178.82 for Growth; bad signature rejected; valid verify → PAID with invoice `MKT/…`, CGST/SGST 9% each; webhook replay doesn't double-grant; webhook with bad signature → 401.
- Brand: slot cap refuses a third hero booking; online payment (IGST for Gujarat billing, ₹8,850), offline transfer, review, cancel; go-live creates the network banner and a per-org promo (333 listings discounted); feed shows store + brand banners within caps; block/allow-off hides brand banners; events → results (40 views, 3 taps, 7.5% CTR); ending restores all prices; claims CSV; brand partner sees only their brand (404 for others, 403 on platform endpoints).
- AI art: three banners for one store came out in three different layouts and styles with large bold headlines.

## Needs manual verification

- Razorpay checkout end to end with real test cards/UPI in the admin web app and the mobile app (only the signature path was simulated).
- The webhook from the real Razorpay dashboard on the deployed API.
- Invoice look in print/PDF.
- Mobile: banner view/tap counts appearing after browsing; "Sponsored" label; plan purchase flow in the Manage app.
- Prod OpenAI key: the API process must load `apps/api/.env`'s key (the shell's `OPENAI_API_KEY` has no credits).
