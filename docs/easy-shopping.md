# Easy shopping: speak a list, keep a list, get a cart

Plan and later phases: [easy-shopping-plan.md](easy-shopping-plan.md). This doc covers Phase 1 as built: the cart builder API (batch 1), the voice list screen (batch 2), and My list with the Home shortcuts (batch 3).

## How it works

**Home shortcuts** (`components/home/EasyShopRow.tsx`): three equal pills right under the search bar, spanning its width. They're part of the header, so they're visible as soon as Home opens on normal and festive days, and they fold away with the location row on scroll.
- **Speak list** opens `/speak-list`.
- **My list** opens `/my-list`. A count shows how many items are on the list.
- **Last order** loads the customer's latest delivered order into the Buy it again picker (`useReorder`). It's hidden for guests and first-time shoppers.

**Speak your list** (`app/speak-list.tsx`):
- The mic starts listening in the app language (Tamil or English) and keeps listening until the customer taps stop.
- The session never restarts mid-list, so no words get clipped. Each 1.5 s pause hands over the words said since the last item, and those become one line on a ruled "paper" card.
- The recogniser gets grocery-word hints (`LIST_HINTS`, English and Tamil), so names like "toor dal" aren't misheard.
- Lines can be edited, removed or typed. **Find N items** sends them to `POST /api/v1/list-to-cart` with `source: "VOICE"`.

**My list** (`app/my-list.tsx`):
- A notepad kept on the server (`shopping_list_items`), so it survives reinstalls. Items are added by typing or by mic, one at a time, and edited or removed in place.
- **Make my cart** calls `POST /shopping-list/build` (`source: "LIST"`).
- After adding to the cart, items whose words became a cart line are ticked off with `POST /shopping-list/done`. Skipped lines stay on the list.

**Recent lists** (`components/shopping-list/RecentLists.tsx`): below My list, the customer's last 5 distinct lists, newest first. They come from `cart_builder_runs`, so both spoken lists and My list builds appear, and rebuilds of the same list are merged. Each card shows the date and time, the store, the item count and a preview. Tapping one opens a sheet with all its items ticked. The customer unticks what they don't need, and **Add N to my list** puts the rest on My list (`POST /shopping-list/bulk`, which skips items already there). From there they refine and **Make my cart** as usual.

**Cart builder** (`apps/api/src/services/cart-builder/`):
- **parse.ts**: one Claude Haiku 5.5 call with structured output splits the text into lines. Each line has the customer's own words, an English catalog search term, a brand, and an amount in g / ml / pcs / pack or a rupee amount. Local quantity words (kaal kilo, arai kilo, mukkaal kilo) are in the prompt.
- **match.ts**:
  - Each line gets a plain keyword search on its English term. The fuzzy and full-text fallbacks run only when that finds nothing, and the customer's own (Tamil) words are tried last.
  - All hits load in one query and out-of-stock items drop out.
  - Products the customer has bought at this store rank first, by order count.
  - Up to **10** products come back per line, trimmed to the fields the review needs (`CartBuilderProduct` in the shared package).
- **variant-pick.ts**: picks the pack and count for the amount asked. "2 kg" with a 1 kg pack gives 2 × 1 kg; "250 g" with 100 g and 500 g packs gives 1 × 500 g; "₹10 worth" gives ₹10 of the cheapest pack.
- Each line comes back as one of three:
  - **MATCHED**: the customer named the brand or has bought it here before, so it goes straight in the cart.
  - **PICK**: the customer chooses.
  - **NOT_FOUND**: nothing in stock.
- Every request is logged in `cart_builder_runs`: input, lines, products offered, token use, and (via `/outcome`) what the customer kept.

**Review screen** (`components/cart-builder/`):
- Each card shows "You said …" above what was found.
- **Choosing:** where the products differ, a row of **type** chips (Cow ghee, Buffalo ghee) and then **brand** chips narrow the choice. The products scroll sideways, three at a time on screen.
- **Each tile:** shows the price with the struck-out MRP and a **% OFF** pill when on offer. A tap chooses it; **Details** opens the product page.
- **A chosen item:** has a −/+ counter, **Change** and **Remove**. Tapping its picture or name opens the product page.
- **Read aloud:** reads the cart in the app language (`expo-speech`). iOS switches to loudspeaker playback first, and the button is hidden when the phone has no voice for the language.
- **Add N items:** puts the items in the cart, asking first when the cart holds another store's items ("Adding these clears it…").

Rate limits: 10 lists a minute per customer, separately for `/list-to-cart` and `/shopping-list/build`. The AI order chat shares the limiter helper (`services/rate-limit.ts`) and runs on Haiku 5.5 at low effort.

## List glossary

How shoppers say staples in their language, and the word the catalog lists them under (kadalai maavu → **besan**, ulundhu → **urad dal**). The AI that reads lists gets these in its prompt. Adding them lifted the eval from 97% to about 99%, and stopped besan being read as roasted gram flour (sattu).

- **Data:** `list_glossary_terms` holds one row per catalog word, with an optional note ("raw gram flour, never roasted") and on/off. `list_glossary_phrases` holds the ways to say it, each tagged with a language (`ta`, `kn`, `ml`, `te`, `hi`), in native script or romanised. A phrase is unique within its language. The glossary is platform-wide, not per organisation.
- **Admin:** Inventory → **List glossary** (Super Admin only) lets you add, edit, search, filter by language and switch terms on or off.
- **API:** `services/cart-builder/glossary.ts` keeps the active terms in memory for 5 minutes. Any admin edit clears that copy, so the next list uses the change.
- **Which languages are used:** a list gets the phrases for the languages of its store's organisation regions (TN → Tamil, KA → Kannada, KL → Malayalam, AP/TS → Telugu, DL/UP → Hindi), plus the customer's app language. A region with no mapped language gets every language.
- **Seed:** `npx tsx prisma/seed-list-glossary.ts` loads the first 23 Tamil and Tanglish terms. It's safe to run again; it upserts by catalog word.
- **Admin API:** `GET/POST /list-glossary`, `GET/PUT/PATCH/DELETE /list-glossary/:id`. A duplicate catalog word, or a phrase repeated within the same language, returns 409.

## Speech

Speak list and My list record each item on the phone and send it to `POST /api/v1/speech/transcribe`. The phone's own recogniser can't do Tamil on iPhones. The API sends the clip to **Sarvam saaras:v4**.

- **Recording (`apps/mobile/lib/use-cloud-voice.ts`):**
  - `expo-audio` records 16 kHz mono AAC with metering, about 10 KB per item.
  - A clip is cut after 1.2 s of quiet following speech. Quiet is measured against the room's own noise level, so a noisy shop still cuts. Clips are capped at 15 s (`SPEECH_MAX_SECONDS`).
  - Items are written out in the order spoken. "…" rows show items still being written, and Find waits for them.
- **Language:**
  - Sarvam listens in the store's region language (`REGION_LANGUAGES`: Tamil Nadu → `ta-IN`), whatever the app language. A shopper can speak Tamil, English or both mixed.
  - With the app in English, the text comes back in English letters (Sarvam `mode=translit`): "Oru kilo thuvaram paruppu", "Half kilo sugar". With the app in Tamil, it's in Tamil script.
- **Keyterms:**
  - `glossaryKeyterms()` in `services/cart-builder/glossary.ts` sends up to 50 words for Sarvam to listen for. They are the glossary's native-script phrases for that language plus the amount words (கிலோ, அரை கிலோ…).
  - Editing the glossary in the admin panel updates them straight away.
- **Fallback:**
  - If voice is off on the server (503), Sarvam fails (502) or there is no network, that session carries on with the phone's recogniser and shows a toast.
  - App builds without `expo-audio` (1.0.6 and older) always use the phone's recogniser.
  - The search-bar mic always uses the phone's recogniser.
- **Cost:** ₹30 per hour of audio, billed per second. One spoken item (about 2 s) costs about ₹0.017. Each clip is logged once (`speech transcribed`: bytes, ms, language, keyterm count, length; the text is not logged).
- **Limits:** 30 items per minute per user, and 1 MB per clip.
- **Env:**
  - `SPEECH_PROVIDER=sarvam` and `SARVAM_API_KEY`. Leaving `SPEECH_PROVIDER` unset turns cloud speech off.
  - The provider switch in `services/speech/index.ts` is where a self-hosted IndicConformer would go later.

## API

| Route | What it does |
| --- | --- |
| `POST /list-to-cart` | `{ storeId, text, source }` → `{ runId, lines }` |
| `POST /list-to-cart/:runId/outcome` | `{ chosen: [{ line, storeProductId, quantity }] }`; own runs only |
| `GET /shopping-list` | Open items, oldest first |
| `POST /shopping-list` | `{ text }`; at most 100 open items |
| `PATCH /shopping-list/:id`, `DELETE /shopping-list/:id` | Edit or remove an item; own items only |
| `POST /shopping-list/build` | `{ storeId }` → the list-to-cart result plus `itemIds` |
| `POST /shopping-list/done` | `{ ids }` ticks items off |
| `GET /shopping-list/recent` | The customer's last 5 distinct lists from their cart builds |
| `POST /shopping-list/bulk` | `{ texts }` adds several items; ones already on the list are skipped |
| `POST /list-to-cart/line` | `{ storeId, text }` re-matches one re-worded line during review |
| `POST /speech/transcribe` | Multipart `file` (m4a/aac/wav) + `storeId`, `language` → `{ text }` for one spoken item |

## What was tested

- **Unit tests:** `variant-pick.test.ts` covers sizes, rounding up, money's worth and packs. `pnpm --filter @martly/api test` passes 15/15.
- **Eval:** `npx tsx scripts/cart-builder-eval.ts [storeId] [count]` builds 200 lists (100 Tamil, 50 Tanglish, 50 English) from 55 labelled staples in `scripts/cart-builder-eval/items.json`, and runs them against Harur Fresh Mart. Latest results:
  - lines split right in 99.5% of lists
  - **97.0%** of 1,436 lines put the top product in the right subcategory (Tamil 97.4%, Tanglish 98.0%, English 95.1%)
  - every MATCHED line was right (72/72)
  - Claude cost **$0.0004 per list**
- **curl, list-to-cart:**
  - Tanglish and Tamil lists matched.
  - History ranking worked: a customer's usual milk, ghee and dish bar came first and were MATCHED.
  - Errors: bad body 400, unknown store 404, another customer's run 404, and the 11th request in a minute 429.
  - With 10 candidates, "1 kg ghee" returns Cow and Buffalo ghee across 8 brands, 9 of them on offer. The response is about 10 KB per line.
- **curl, shopping list:** list, add (text trimmed), edit, delete (again → 404), unknown id 404, blank text 400, build (unknown store 404), done (empty ids 400), no token 401. The review customer is seeded with five items (`npx tsx prisma/seed-easy-shopping.ts`).
- **Timing:** 4–7 s for a 3–10 item list, about 3 s of it Claude and the rest store search at 0.7–1 s per query.
- **iPhone, 2026-10-20 (steps 1–7):** opening the screen by link, listening, the review, picking, the total, adding to the cart (the outcome was recorded line by line), replacing a cart from another store, and change, remove, add back and counts. Fixes from that session are in.

## Needs manual verification (on a phone)

The app needs the new dev-client build (version 1.0.7, build 8) because `expo-speech` is a native module.

- **Home:** the three pills sit under the search bar at its width, on festive and normal themes, and fold away on scroll. Tamil labels fit. My list's count matches the list. Last order opens the picker for a customer with a delivered order, and is hidden for one without.
- **Speak your list:** a 10-item Tamil list with pauses gives one line per item, with no clipped first word. Also check an older Android phone (before 13).
- **Read aloud:** plays through the loudspeaker, in Tamil and English.
- **Review:** type and brand chips on "1 kg ghee"; sideways scrolling past three products; % OFF pills; **Details** and tapping a chosen item's picture both open the product page.
- **My list:** add by typing and by mic, edit, remove, then **Make my cart** → review → add. The added items disappear from the list and skipped ones stay. Close and reopen the app: the list is still there.
- **Not in stock:** a line's **Search** opens search with that word.
- **Signed out:** both screens ask the customer to sign in.

## Known gaps

- "2 kg ponni rice" offers 5 kg and 10 kg packs because the store sells no 2 kg. Ranking by pack fit was left out on purpose: it put a 2 × 1 kg *basmati* ahead of ponni. What the product is must outrank its pack size.
- "50 g cumin" usually matches cumin powder before seeds, and "groundnut oil" sometimes ranks gingelly oil first. These come from store search ranking and show as PICK, so the customer chooses.
- Store search takes 0.7–1 s per query, which is most of the remaining wait. Speeding it up would help regular search too.
- My list ticks off an item when its words match a cart line's words. If the parser reworded an item a lot, it stays on the list, which is the safe side.
- If the iOS recogniser rewrites words it has already heard, mid-list, the pause split can shift by a word. Watch for it in testing.
