# AI image allowance and image packs

Every organisation has one meter for the AI images its team asks for. Each marketing plan includes a monthly
allowance, and owners can buy image packs on top of it.

## How it works

- **Allowance:** `AdProduct.aiImagesPerMonth`. Free has 5, Growth 30 and Pro 100.
  - A paid plan resets every 30 days of its period.
  - Free resets each IST calendar month.
  - The numbers can be changed on the admin pricing page.
- **Packs:** `AI_IMAGE_PACK` products, 25 images for ₹299 or 100 images for ₹999, plus GST.
  - Bought once, through `POST /marketing/orders` and Razorpay, the same way as an extra promotion.
  - Pack images never expire.
  - Every plan can buy them, Free included.
  - The images are credited when the order is fulfilled (`deliver()` in `services/marketing/billing.ts`).
- **Ledger:** `AiImageCreditEntry` is append-only.
  - Plan moves are `fromPlan = true`; pack moves are `fromPlan = false`.
  - Each entry has a reason: `TOPUP`, `USED`, `REFUND` or `ADJUST`.
  - `purpose` and `refId` record what the images were spent on.
- **Balance:** `getEntitlements().aiImages` returns `{ used, total, planLeft, packBalance, left, resetsAt }`. The code is in `services/marketing/ai-image-balance.ts`.
- **Charging:** `withAiImages()` in `services/marketing/ai-images.ts` does the following:
  - It reserves the images before painting, under a per-org advisory lock. The plan's month is spent first, then packs.
  - If painting throws, it gives all the images back.
  - When there aren't enough images, it returns 402 with `error: "AI_IMAGES_EXHAUSTED"`, and the apps open the pack purchase.
  - After a successful paint, the owners get a "Running low" push and in-app notice the first time 80% of the month's plan images are used. It fires once per allowance window, using `alertOnce`.
- **Not charged:**
  - SUPER_ADMIN (`meteredOrg()`).
  - Automatic festival curation, from the scheduler or the Curate button.
  - AI promotions, which are paid for by their promotion credit, including the 2 free redrafts.
  - Catalog product photos.
  - Brand campaigns, which keep their own cap of 6 per brand per day.

## What each action costs (`AI_IMAGE_COST`)

Images are counted as finished images the owner gets. Repaints and retries on our side are free.

| Action | Route | Images |
|---|---|---|
| Promo "Generate with AI" image, promo banner regenerate | `POST /promos/generate-image`, `POST /promos/:id/banner/generate` | 1 |
| Collection banner regenerate | `POST /collections/:id/regenerate-banner` | 1 |
| Festival hero regenerate | `POST /collections/:id/regenerate-hero` | 7 reserved; the strip and tiles it didn't paint are given back |
| Home tile art | `POST /home-layout/:id/art` | 1 per tile; tiles that fail are given back |

## Migrations

- `20261019180000_ai_image_credits` adds:
  - the ledger table
  - the `AiImagePurpose` enum
  - the `AI_IMAGE_PACK` product kind
  - `ad_products.ai_image_credits`
- `20261019180100_ai_image_plans`:
  - Sets the new allowances, but only where a plan still has its old default (0/2/6), so numbers an admin already edited are kept.
  - Inserts the two packs, skipping a pack whose code already exists.
- Promo banner images used earlier in the current month were counted from `BannerArtRun`. The meter starts fresh from the ledger, so this month's earlier banners don't count against the new allowance.

## Tested

A script run against Demo Grocers covered the following; it removed every row it created afterwards:
- Charging from the plan, then from packs.
- The 402 when there aren't enough images.
- Partial and full refunds.
- An offline pack purchase: ₹299 + 18% GST = ₹352.82. Fulfilling it twice credits it once.
- A failed paint refunded.
- SUPER_ADMIN never charged.

## Needs manual verification

- **Admin and app:** the usage line beside each generate button, the low and out states, and the pack purchase through Razorpay.
- **Push:** the "Running low" push on a real device.
- **Pricing page:** editing allowances and packs.
