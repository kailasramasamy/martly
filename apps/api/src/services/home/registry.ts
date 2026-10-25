import type { HomeSectionType } from "@martly/shared/constants";
import type { SectionResolver } from "./types.js";
import { bestsellerCategories } from "./resolvers/bestseller-categories.js";
import { brandCard } from "./resolvers/brand-card.js";
import { buyGetDeals } from "./resolvers/buy-get-deals.js";
import { campaignCard } from "./resolvers/campaign-card.js";
import { heroCards } from "./resolvers/hero-cards.js";
import { categoryDirectory } from "./resolvers/category-directory.js";
import { priceBandDeals } from "./resolvers/price-band-deals.js";
import { productRow } from "./resolvers/product-row.js";
import { storeSpecials } from "./resolvers/store-specials.js";
import { storeWalk } from "./resolvers/store-walk.js";
import { monthlyList } from "./resolvers/monthly-list.js";
import { tabbedRow } from "./resolvers/tabbed-row.js";
import { themeBand } from "./resolvers/theme-band.js";
import { tileGrid } from "./resolvers/tile-grid.js";
import {
  brandPosters, buyAgain, clientFetched, deals, departmentGrid, festiveHero, heroBanners, offers, recipes, timePicks,
} from "./resolvers/system.js";

// Types later phases build resolve to nothing, so a layout that already lists them simply skips them
const notBuilt: SectionResolver = async () => null;

export const RESOLVERS: Record<HomeSectionType, SectionResolver> = {
  FESTIVE_HERO: festiveHero,
  MEMBER_CHIPS: clientFetched,
  HERO_BANNERS: heroBanners,
  BUY_AGAIN: buyAgain,
  RECENTLY_VIEWED: clientFetched,
  DEPARTMENT_GRID: departmentGrid,
  BRAND_RAIL: clientFetched,
  PLUS_PROMO: clientFetched,
  TIME_PICKS: timePicks,
  DEALS: deals,
  RECIPES: recipes,
  LIVE_CAMPAIGNS: notBuilt,
  OTHER_COLLECTIONS: notBuilt,
  CATEGORY_DIRECTORY: categoryDirectory,
  OFFERS: offers,
  BRAND_POSTERS: brandPosters,
  PERSONALISED: notBuilt,
  PRODUCT_ROW: productRow,
  CAMPAIGN_CARD: campaignCard,
  TABBED_ROW: tabbedRow,
  PRICE_BAND_DEALS: priceBandDeals,
  BRAND_CARD: brandCard,
  EXPLORE_GRID: tileGrid,
  STORE_GRID: tileGrid,
  BESTSELLER_CATEGORIES: bestsellerCategories,
  THEME_BAND: themeBand,
  STORE_SPECIALS: storeSpecials,
  BUY_GET_DEALS: buyGetDeals,
  HERO_CARDS: heroCards,
  STORE_WALK: storeWalk,
  MONTHLY_LIST: monthlyList,
};
