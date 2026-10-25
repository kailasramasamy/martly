# Store experience: bringing the shop stroll into the app

Research notes (2026-10-25) on how Tier-2 shoppers (Dharmapuri, Salem) buy groceries, and the five features we're trying
because of it. Each one gets a mockup review before any code.

## What the research says

- **Online loses the unplanned buy.** 47% of shoppers made an unplanned new food purchase in-store over three months,
  against 30% online. List and reorder flows remove the friction that leads to discovery
  ([Retail Insider](https://retail-insider.com/retail-insider/2026/06/why-grocery-e-commerce-still-struggles-with-impulse-discovery/)).
- **Serendipity, trust and flow drive impulse buying in apps**, with serendipity the central factor
  ([Management Decision](https://emerald.com/insight/content/doi/10.1108/MD-07-2021-0900/full/html),
  [HRMARS retail-app study](https://hrmars.com/ijarbss/article/view/25930/Exploring-the-Impact-of-Hedonic-Consumption-Tendency-Serendipity-and-Cognitive-Flexibility-on-Impulsive-Grocery-Shopping-Behaviour-via-Retail-Apps)).
- **Kiranas still hold ~91% of Indian grocery**, on trust, credit and frequent small purchases
  ([Redseer](https://redseer.com/reports/why-indias-mass-grocery-still-leans-on-kirana-stores/)).
- **New online shoppers come from small towns.** Three in five since 2020 are from Tier-3 or smaller cities, and
  hyper-value shopping is growing fast ([Bain 2025](https://bain.com/insights/how-india-shops-online-2025)). One in four
  new Instamart users is from Tier-2/3 ([IMARC](https://www.imarcgroup.com/indian-online-grocery-market)).
- **Kirana habits:** loose quantities and bargaining ([IIMB](https://repository.iimb.ac.in/handle/2074/18361)).
  Grocery is ~26% of a lower-middle-income household's monthly spend
  ([Outlook Money](https://www.outlookmoney.com/personal-finance/inside-the-wallet-of-indians-42-per-cent-show-increased-interest-in-credit-on-upi)).

Published data on Dharmapuri or Salem, basket size by city tier and salary-day timing is thin. The behaviour below is our
reading of Tamil Nadu town households; check it against our own order data.

## How a town household shops (hypothesis)

1. **Two rhythms.** A monthly provision (மளிகை) list around the 1st–7th, when salary or pension lands: rice, dal, oil,
   masala, soap, detergent. Small top-ups through the month: milk, vegetables, snacks, the forgotten item.
2. **Weekly and ritual rhythms.** Thursday evening for Friday pooja, the Saturday oil bath, Sunday non-veg masala,
   Amavasya, Pradosham, Karthigai, June school reopening, wedding season.
3. **Trust lives with the annachi.** "New stock came", "take this brand", credit till month end.
4. **Price-literate.** MRP savings and small packs matter.

The idea in one line: physical shopping works through **memory cues**. Walking past the oil shelf reminds you that you
need oil. The app has to supply those cues on purpose, while the fast path stays fast.

## What Martly already has

Buy again, Smart Reorder, "Did you forget?" in the cart (reorder prediction), gap fillers, Frequently bought together,
Speak list, My list, list-to-cart, festival curation, Time-of-day picks, bestseller categories, theme bands, store
specials, recipes, Tamil UI.

## The five features

| # | Feature | What it does | Status |
|---|---------|--------------|--------|
| 1 | **Walk the store** | Guided pass through the store's aisles in shelf order. Each aisle shows the shopper's due item, then the aisle's bestsellers; "I have enough" moves on. A memory checklist by aisle, not by product | Built 2026-10-25, phone check pending ([store-walk.md](store-walk.md)) |
| 2 | **Monthly provision list** | My list as a template that comes back every month; nudge on the 1st–5th with today's total | Not started |
| 3 | **The annachi's voice** | "Fresh today / New in store" posts from Manage, and an "Owner recommends" tag on products | Not started |
| 4 | **Ritual-calendar nudges** | Weekly and monthly rituals (Friday pooja, Amavasya, oil bath) as small Home bands and timed notifications, on top of the festival calendar | Not started |
| 5 | **Add to my order** | After an order is placed, add items to it until packing starts, with no new delivery fee | Not started |

Dropped: monthly credit (khata). Stores won't extend credit to online customers they don't know.

## 1. Walk the store: mockups

Canvas: https://claude.ai/artifact/L7oAEtqGsnBKMinAcJcLxW (six phone screens; Play runs the flow).

1. **Home entry.** A "Walk the store" card under the Easy Shop pills, showing items due, aisle count and time.
2. **Choose your walk.** "My usual aisles" (the categories this shopper buys here, the default) or "Every aisle".
   Route preview in shelf order, with due and ritual badges.
3. **Aisle with a due item.** Progress segments, the aisle name with its Tamil name, a "Running low?" card for the due item,
   then "Popular in this aisle" (5 bestsellers and a "See all" tile). The dock shows the bag total, "I have enough" and
   "Next aisle".
4. **Aisle you never shop.** No due item, so the screen leads with the context (Friday pooja tomorrow), a note from the
   store, and "What others buy here".
5. **Aisle map.** A sheet showing done, skipped, current and upcoming aisles; tap one to jump there.
6. **Walk done.** Item count, total and time; a due item still missing, with ADD; the bag grouped by aisle; skipped aisles
   with a way back.

Open questions for the review:
- **Stop size:** one stop per category (Dal & Pulses), as drawn, against one per department (Grocery & Staples, too broad)
  or per subcategory (too many).
- **"Every aisle":** stops at categories with stock at the store only, and caps them at about 24?
- **Entry:** always on Home, or only in the first week of the month and when items are due?
- **Shelf order:** department and category `sortOrder` today. Stores may want their own walking order.
