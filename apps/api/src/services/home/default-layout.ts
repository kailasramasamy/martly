import type { HomeSectionType } from "@martly/shared/constants";
import type { LayoutEntry } from "./types.js";

// The order for organisations that have not saved a layout of their own: the hero cards (then the monthly list in a
// shopper's reminder week), the festive top (for app builds
// before the hero cards, which skip them) and offers, then the best-selling
// categories, the shopper's own repeat buys, the store walk and the department grid so shoppers can shop straight away, then the hero
// banners (pinned after the department grid for every layout, as they carry paid brand banners), promotions and the rest
const DEFAULT_ORDER: HomeSectionType[] = [
  "HERO_CARDS", "MONTHLY_LIST", "STORE_POSTS", "FESTIVE_HERO", "MEMBER_CHIPS", "BESTSELLER_CATEGORIES", "OFFERS", "BUY_AGAIN", "STORE_WALK", "DEPARTMENT_GRID", "HERO_BANNERS",
  "STORE_SPECIALS", "LIVE_CAMPAIGNS", "RECENTLY_VIEWED", "BRAND_RAIL", "BRAND_POSTERS", "PLUS_PROMO", "OTHER_COLLECTIONS", "TIME_PICKS", "DEALS", "BUY_GET_DEALS", "RECIPES",
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
