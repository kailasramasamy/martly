import type { HomeSectionType } from "@martly/shared/constants";
import type { SectionResolver } from "./types.js";
import { campaignCard } from "./resolvers/campaign-card.js";
import { productRow } from "./resolvers/product-row.js";
import {
  buyAgain, clientFetched, deals, departmentGrid, festiveHero, heroBanners, midBanners, recipes, timePicks,
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
  MID_BANNERS: midBanners,
  TIME_PICKS: timePicks,
  DEALS: deals,
  RECIPES: recipes,
  LIVE_CAMPAIGNS: notBuilt,
  OTHER_COLLECTIONS: notBuilt,
  CATEGORY_DIRECTORY: notBuilt,
  OFFERS: notBuilt,
  BRAND_POSTERS: notBuilt,
  PERSONALISED: notBuilt,
  PRODUCT_ROW: productRow,
  CAMPAIGN_CARD: campaignCard,
  TABBED_ROW: notBuilt,
  PRICE_BAND_DEALS: notBuilt,
  BRAND_CARD: notBuilt,
  EXPLORE_GRID: notBuilt,
  STORE_GRID: notBuilt,
};
