# Annachi's voice: the owner speaks in the app

This is feature 3 of the [store-experience plan](store-experience-plan.md). In a town kirana, trust lives with the owner:
"new stock came", "take this brand". This feature gives the owner two ways to say that in the app:
- **Posts:** "Fresh today", "New in store" and "Back in stock". They show on Home and on the shop's board, and can be
  sent as a push.
- **Owner's picks:** a badge on products the owner vouches for, and a line on the product page saying why.

The mockups are on the canvas "Store experience mockups", page "Annachi's voice".

## Data

- **`StorePost`:**
  - Fields: `storeId`, `authorId`, `kind` (`StorePostKind`: FRESH_TODAY | NEW_IN_STORE | BACK_IN_STOCK), `text`,
    `language` (what the owner wrote in, detected from the script: "ta" or "en"), `translations` (the other language,
    `{ en: { text } }`), `expiresAt` and `notifiedAt`.
  - Tagged products are in `StorePostProduct`, in the order tagged. They are products, not sizes: shoppers see each
    one's cheapest in-stock size.
- **`StorePick`:** `storeId`, `productId`, `note` (≤90 chars), `language`, `translations` and `authorId`, unique per
  store and product.
- **`HomeSectionType.STORE_POSTS`:** placed after `MONTHLY_LIST` in saved layouts and the default layout.
- **Migrations:** `20261025180000_store_posts_section_type`, `…180100_store_voice` and
  `…180200_store_posts_home_section`.

## API (`/api/v1/store-voice`)

| Route | Who | What it does |
|---|---|---|
| `GET /posts/live?storeId=` | anyone | Live posts from the last 7 days, newest first, each with its products as listings |
| `GET /posts?storeId=` | team (LISTING_MANAGE + store access) | All of the store's posts from the last 30 days, live or ended |
| `POST /posts` | team | `{ storeId, kind, text, productIds (≤6), days?, notify }`. 400 if a tagged product isn't listed at the store |
| `POST /audience` | team | `{ storeId, kind, productIds }` → `{ count, scope: "AISLES" \| "ALL" }`, who a push would reach |
| `POST /translate` | team | `{ text }` → `{ language, translations }` for the form's preview; null without a key or when the API fails |
| `GET /posts/:id` | team | One post to edit, with every tagged product (in stock or not) |
| `PUT /posts/:id` | team | `{ kind, text, productIds, days?, notify }`. Without `days` the end date stays; new words are translated again |
| `DELETE /posts/:id` | team | Removes a post |
| `GET /picks?storeId=&productId=` | team | `{ aisle, limit, picks }` for the product's aisle |
| `PUT /picks` | team | `{ storeId, productId, note }`. 409 for a 4th pick in an aisle; 400 if the product isn't listed |
| `DELETE /picks?storeId=&productId=` | team | Removes a pick |

### Rules

- **How long a post shows:**
  - `days` 0 means today only (until 23:59 IST); 3 and 7 mean that many days from today.
  - Left out, it follows the kind: Fresh today → today, Back in stock → 3 days, New in store → 7 days.
- **Push (`services/store-voice/notify.ts`):**
  - At most **one post push per store per IST day** (`claimOnce` key `store-post-push:<store>:<day>`). A later post still
    saves and shows; the reply says `notified: false`.
  - **Audience** (`postAudience`), always from shoppers with a non-cancelled order at the store in the last 60 days:
    - Fresh today / Back in stock: those who bought from the aisles of the tagged products.
    - New in store: everyone. It's for discovery, so it shouldn't be limited to past buyers of that aisle.
    - The floor: aisle buyers fewer than 25, or no products tagged, widens it to everyone, so a small store never
      notifies nobody.
    - The form shows the count under "Notify shoppers" (`POST /audience`), e.g. "All 3 shoppers who ordered here in
      the last 60 days will get this".
  - It goes out as a `STORE_NOTICE` campaign titled with the store's name; the body is the post's text as written.
  - The tap opens the board (`data.screen = "store-posts"`).
- **Picks:** at most **3 per aisle** (category) per store (`MAX_PICKS_PER_AISLE`). A pick is a badge only, with no
  change to search or listing rank.
- **Translation (`services/translate/store-voice.ts`):**
  - Runs after saving, with Haiku: Tamil → English, English → Tamil.
  - It fills only an empty translation. Changing a pick's note clears the old one.
  - With no key, or a failed call, the owner's words show as written and the error is logged.
- **Every listing carries the pick:** `decorateStoreProducts()` adds `ownerPick: { note, language, translations, author }
  | null`, so search, aisles, the walk, Home rows and the product page all get it with one extra query.

## Mobile

### Shoppers

- **Home** (`StorePostsSection`):
  - The "From the shop" card: the store logo (fitted in a circle) or the owner's initial, "Name, owner · Today, 7:40 am",
    and a kind tag.
  - Then the post in the app's language, up to 3 product tiles with + / − n +, and "N more from the shop this week".
- **The shop's board** (`app/store-posts.tsx`): live posts with ADD rows. Opened from the Home card or a push.
- **Owner's pick:**
  - A solid teal "Owner's pick" badge on `CompactProductCard` and `FeaturedProductCard`. It ranks above the brand-pick
    label; ads still come first.
  - A teal shelf talker on the walk's packs.
  - On the product page, the "OWNER RECOMMENDS" quote.
- **Strings:** the `storeVoice` namespace in English and Tamil.

### Owner (Manage)

- **Marketing → Shop posts** (`store-posts` resource, needs LISTING_MANAGE): posts with live/ended status, the
  translation once it lands, Edit (the same form, filled in; the end date stays unless changed, and it doesn't notify
  unless asked) and Delete.
- **+ opens the form:**
  - Kind, the text (typed, or "Speak instead" through Sarvam via `useCloudVoice` with `purpose: "post"`).
  - **Translation preview** (`TranslationPreview`): 1.2 s after typing or speech settles, "Shoppers reading in Tamil
    (or English) see" fills in, and the owner can correct it. Post sends it as `translations`, and the background fill
    never overwrites it. If the owner edited it and then changes the post, "Translate again" appears rather than
    replacing their edit. Post waits while it's translating.
  - **Post speech mode** (`transcribePost`): Sarvam detects the language, and English or Tamil is accepted for now, so any
    other language gets 400 "Speak in English or Tamil". Tamil stays in Tamil script and English stays English, so the
    post is translated the right way, and each sentence keeps its full stop. Shopping lists keep the list mode: the
    store's language, grocery hints, and Tamil in English letters for English-app shoppers.
  - Checked with recorded clips: English came back as English in both modes; Tamil came back in Tamil script in post
    mode ("ஊட்டி கெரட் இன்று காலை வந்தது.") and in English letters in list mode.
  - Up to 6 tagged products, how long it shows, and "Notify shoppers".
- **Products → a product → Owner's pick:** "I recommend this", a one-line reason with 4 starter phrases, and the aisle's
  picks (N of 3) with Remove.

## Tested

- **Seed:** `cd apps/api && npx tsx prisma/seed-store-voice.ts` adds 3 posts (fresh vegetables today, wood-pressed oils
  new, small onions back) and 2 picks in Edible Oils at Harur Fresh Mart, from owner@harur.dev.
- **Shopper routes:**
  - Live posts come back with their products and today's prices.
  - Home sections give HERO_CARDS, MONTHLY_LIST, then STORE_POSTS (`more` 2, 3 tiles).
  - `ownerPick` shows on search results and on the product page's listings.
- **Owner routes:**
  - A customer gets 403 on POST; a tagged product not at the store gives 400.
  - The owner's list returns all posts.
  - Notify: the first post that day sent (`notified: true`) and the second didn't (`false`).
  - "Today only" ends at 23:59 IST; Back in stock ends 3 days on.
  - The 4th pick in Edible Oils gave 409. Test rows were cleaned up afterwards.
- **Audience:** 0 recipients for a vegetables post at Harur, which is correct. Its 3 recent shoppers bought no
  vegetables.
- **Translation** (with a valid local key): the preview works both ways ("Fresh batches of Shimla apples have
  arrived…" → "ஷிம்லா ஆப்பிள் புது லாட் வந்திருக்கு…", and Tamil → English). The owner's own Tamil was kept on save.
  A post without one was translated in the background within seconds.
- **Type checks:** the API and admin are clean; mobile has the same 14 errors it had before.
- **Phone:** the Home card renders (FRESH TODAY, byline, text). The logo was then refitted to stop it being cropped.

## Needs manual verification

- **Phone, shopper:**
  - The board, ADD and the stepper on tiles.
  - The badge on search and aisle cards, and the walk's shelf talker.
  - The product page quote (Gingelly Oil (Wood Pressed)).
  - Everything again in Tamil.
- **Phone, Manage** (owner@harur.dev / owner123):
  - Write a post by typing and by speaking; tag products; notify.
  - Pick and unpick a product, and hit the 3-pick limit.
- **Prod:** that translations land on Railway, and a real push goes to an audience.
- **Ships with a store build:** mobile has no OTA updates.
