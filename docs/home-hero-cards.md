# Home hero cards

An Instamart-style carousel of tall cards that leads Home. The colour wash behind the header follows the card in view, and the Speak list / My list / Last order pills under the search bar take the card's colour.

## Flow

1. **Layout.** The `HERO_CARDS` home section sits at `sort_order` 0. Migration `20261025100100_hero_cards_home_section` inserted it into every saved layout, and `DEFAULT_LAYOUT` leads with it.
2. **Resolver.** `apps/api/src/services/home/resolvers/hero-cards.ts` builds the cards in the order of `config.cards`. The default order is FESTIVE, BUY_GET, MOST_BOUGHT, STORE_SPECIAL, RIGHT_NOW.

   | Card | Source | Shown when |
   |---|---|---|
   | FESTIVE (poster) | `festiveHeroesFor` (the live festival) | a festival is live and stocked |
   | BUY_GET | `buyGetRow`; 3 products plus the total | 3 or more offers running |
   | MOST_BOUGHT | `services/home/most-bought.ts`; top 30-day sellers in stock | 4 products have sold |
   | STORE_SPECIAL | `storeSpecials()`; the latest one | the store has one in stock |
   | RIGHT_NOW | the collection set for this part of the day (`config.rightNow`, IST: morning 6–12, afternoon 12–5, evening 5–9, night); 4 products, View all opens it | a collection is set for now, with 3 or more products in stock |

   The section is dropped when fewer than 2 cards survive.
3. **Colours.** Each card carries a `HeroCardTheme { tint, tintSoft, ink, card, cardInk }`.
   - Fixed palettes per kind are in `HERO_CARD_THEMES` (`packages/shared/src/constants/home.ts`).
   - The festival card derives its colours from the festival's `heroTheme`. A dark festival gets a pale wash with its colour as the ink. A light festival's card is shaded 8% towards its ink, so it stands off the wash.
4. **Mobile carousel.** `components/home/hero-cards/`:
   - `HeroCardsSection` has 73%-wide cards with peeks and snapping. It auto-advances every 5s while in view, until the shopper swipes.
   - The wash is one `LinearGradient` per card, stacked. Each layer's opacity is driven by the scroll offset on the native driver, so colours cross-fade while swiping.
   - The header (location ink, collapsed band, status bar) switches at the halfway point via `onFestiveTheme`.
5. **Rows the cards replace.** `withoutHeroDuplicates` hides FESTIVE_HERO and BUY_GET_DEALS when their card is in the carousel. Offers are no longer a card; the OFFERS row stays on Home. The server still sends those rows, because older app builds ignore `HERO_CARDS`.
6. **Only the lead section themes the header.** `env.leadId` makes sure of this. A festive hero placed below the cards, when an admin leaves the festival out of the carousel, renders as a plain block.
7. **Search bar.** The bar keeps its voice-search mic. Below it, `EasyShopRow` shows three equal-width white pills ringed and glowing in the card's ink. They fold away with the location row once scrolled, and Last order hides when there is none. Search hints come in the shopper's language (`chrome.searchHintTranslations`); Tamil falls back to `DEFAULT_SEARCH_HINT_TRANSLATIONS`.
8. **Admin.** Home layout → Hero cards → **Cards** is a multi-select whose order is the carousel's order. **Right now** has one collection picker per part of the day. Demo Grocers locally: Breakfast table, Tea time, Instant meals, Sweet cravings; prod needs the same set in the admin.

## Tested

- **API typecheck** is clean, as is the mobile one apart from errors that already existed.
- **Harur Fresh Mart** gets all five cards, each with its theme. The other 8 stores get 3 or 4, since MOST_BOUGHT and STORE_SPECIAL drop when the store doesn't have enough for them.
- **Config:**
  - `["OFFERS","MOST_BOUGHT"]` returns those two cards, in that order.
  - `["OFFERS"]` alone drops the section, and FESTIVE_HERO leads again.
  - Resetting the config to `{}` brings back the default five.
- **The 30-day sales SQL** is now shared by BESTSELLER_CATEGORIES and the most-bought card, and Bestsellers still resolves.
- **Phone:** the Diwali card leads with a pink wash, the search-bar actions are in maroon, the BOGO card peeks at the right, and there are 5 dots.

## Needs manual verification

- **Swiping:**
  - The wash cross-fades smoothly between cards.
  - The header and action ink switch per card: teal, purple, amber, rose.
  - The collapsed header band takes the current card's tint.
- **Cart:** ADD and the stepper work on the BOGO and Most bought cards, and the "1 free" offer flows through to the cart.
- **Navigation:**
  - The BOGO card opens `/buy-get`.
  - The store special opens its collection.
  - Festival tiles open `/festival/[id]` narrowed to that tile.
  - **Pills:** Speak list opens speak-list, My list opens my-list with the count badge, and Last order opens the replace-cart or Buy-again sheet.
- **Tamil:** the pill labels பட்டியல் சொல் / என் பட்டியல் / கடந்த ஆர்டர், the card titles (shrunk to one line) and the search hints.
- **Fallback:** a store without enough cards gets the old festive hero or plain header, with teal actions.
- **Admin:** reorder the cards in the layout drawer, then confirm the app follows.
