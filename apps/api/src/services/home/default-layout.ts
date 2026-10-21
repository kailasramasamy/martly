import type { HomeSectionType } from "@martly/shared/constants";
import type { LayoutEntry } from "./types.js";

// The order for organisations that have not saved a layout of their own: hero banners (pinned there for every layout,
// as they carry paid brand banners) and offers right under the festive top, then promotions and the shopper's own picks
const DEFAULT_ORDER: HomeSectionType[] = [
  "FESTIVE_HERO", "HERO_BANNERS", "OFFERS", "MEMBER_CHIPS", "LIVE_CAMPAIGNS", "BUY_AGAIN", "RECENTLY_VIEWED", "DEPARTMENT_GRID",
  "BRAND_RAIL", "BRAND_POSTERS", "PLUS_PROMO", "OTHER_COLLECTIONS", "MID_BANNERS", "TIME_PICKS", "DEALS", "RECIPES",
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
