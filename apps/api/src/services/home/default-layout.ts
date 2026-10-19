import type { HomeSectionType } from "@martly/shared/constants";
import type { LayoutEntry } from "./types.js";

// The order for organisations that have not saved a layout of their own: promotions and the shopper's own picks
// lead, hero banners follow them
const DEFAULT_ORDER: HomeSectionType[] = [
  "FESTIVE_HERO", "MEMBER_CHIPS", "LIVE_CAMPAIGNS", "BUY_AGAIN", "HERO_BANNERS", "RECENTLY_VIEWED", "DEPARTMENT_GRID",
  "BRAND_RAIL", "PLUS_PROMO", "OTHER_COLLECTIONS", "MID_BANNERS", "TIME_PICKS", "DEALS", "RECIPES",
];

export const DEFAULT_LAYOUT: LayoutEntry[] = DEFAULT_ORDER.map((type) => ({
  id: `default-${type}`,
  type,
  title: null,
  subtitle: null,
  translations: null,
  collectionId: null,
  config: {},
  items: [],
}));
