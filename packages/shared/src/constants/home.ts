/** Blocks the app knows how to draw on Home; system ones need no collection, the rest present one or more */
export const HomeSectionType = {
  FESTIVE_HERO: "FESTIVE_HERO",
  MEMBER_CHIPS: "MEMBER_CHIPS",
  HERO_BANNERS: "HERO_BANNERS",
  BUY_AGAIN: "BUY_AGAIN",
  RECENTLY_VIEWED: "RECENTLY_VIEWED",
  DEPARTMENT_GRID: "DEPARTMENT_GRID",
  BRAND_RAIL: "BRAND_RAIL",
  PLUS_PROMO: "PLUS_PROMO",
  TIME_PICKS: "TIME_PICKS",
  DEALS: "DEALS",
  RECIPES: "RECIPES",
  LIVE_CAMPAIGNS: "LIVE_CAMPAIGNS",
  OTHER_COLLECTIONS: "OTHER_COLLECTIONS",
  CATEGORY_DIRECTORY: "CATEGORY_DIRECTORY",
  OFFERS: "OFFERS",
  BRAND_POSTERS: "BRAND_POSTERS",
  PERSONALISED: "PERSONALISED",
  PRODUCT_ROW: "PRODUCT_ROW",
  CAMPAIGN_CARD: "CAMPAIGN_CARD",
  TABBED_ROW: "TABBED_ROW",
  PRICE_BAND_DEALS: "PRICE_BAND_DEALS",
  BRAND_CARD: "BRAND_CARD",
  EXPLORE_GRID: "EXPLORE_GRID",
  STORE_GRID: "STORE_GRID",
  BESTSELLER_CATEGORIES: "BESTSELLER_CATEGORIES",
  THEME_BAND: "THEME_BAND",
  STORE_SPECIALS: "STORE_SPECIALS",
} as const;
export type HomeSectionType = (typeof HomeSectionType)[keyof typeof HomeSectionType];

/** Types an admin places with a collection behind them */
export const COLLECTION_SECTION_TYPES: readonly HomeSectionType[] = [
  "PRODUCT_ROW", "CAMPAIGN_CARD", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "EXPLORE_GRID", "STORE_GRID",
];

/** Whether a type must, or may, name a collection on the section itself (a tabbed row names one per tab instead) */
export const SECTION_COLLECTION: Partial<Record<HomeSectionType, "REQUIRED" | "OPTIONAL">> = {
  PRODUCT_ROW: "REQUIRED",
  CAMPAIGN_CARD: "REQUIRED",
  PRICE_BAND_DEALS: "OPTIONAL",
  BRAND_CARD: "OPTIONAL",
};

/** Types the layout API can expand into several sections; the app never receives these */
export const EXPANDING_SECTION_TYPES: readonly HomeSectionType[] = ["LIVE_CAMPAIGNS", "OTHER_COLLECTIONS"];

export const HomeSectionTypeLabels: Record<HomeSectionType, string> = {
  FESTIVE_HERO: "Festival hero",
  MEMBER_CHIPS: "Member shortcuts",
  HERO_BANNERS: "Hero banners",
  BUY_AGAIN: "Buy again",
  RECENTLY_VIEWED: "Recently viewed",
  DEPARTMENT_GRID: "Shop by category",
  BRAND_RAIL: "Shop by brand",
  PLUS_PROMO: "Plus membership promo",
  TIME_PICKS: "Time of day picks",
  DEALS: "Deals of the day",
  RECIPES: "Shoppable recipes",
  LIVE_CAMPAIGNS: "Live promotions (automatic)",
  OTHER_COLLECTIONS: "Other collections (automatic)",
  CATEGORY_DIRECTORY: "Category directory",
  OFFERS: "Offers for you",
  BRAND_POSTERS: "Brand posters",
  PERSONALISED: "Curated for you",
  PRODUCT_ROW: "Product row",
  CAMPAIGN_CARD: "Campaign card",
  TABBED_ROW: "Tabbed row",
  PRICE_BAND_DEALS: "Price-band deals",
  BRAND_CARD: "Brand card",
  EXPLORE_GRID: "Explore tiles",
  STORE_GRID: "Shop by store",
  BESTSELLER_CATEGORIES: "Bestseller categories",
  THEME_BAND: "Theme band",
  STORE_SPECIALS: "Store specials",
};

export const SectionHeaderStyle = { PLAIN: "PLAIN", BANNER: "BANNER", ARTWORK: "ARTWORK" } as const;
export type SectionHeaderStyle = (typeof SectionHeaderStyle)[keyof typeof SectionHeaderStyle];

export const TabRailStyle = { ICON_CARD: "ICON_CARD", ICON_UNDERLINE: "ICON_UNDERLINE", PILL: "PILL" } as const;
export type TabRailStyle = (typeof TabRailStyle)[keyof typeof TabRailStyle];

export const HOME_ROW_MAX_PRODUCTS = 12;
/** A product shelf on Home is a 3-column grid of two rows */
export const HOME_SHELF_COLUMNS = 3;
export const HOME_SHELF_PRODUCTS = 6;
export const HOME_SECTIONS_PAGE_SIZE = 8;
/** A price-band grid holds 2 rows of 10 */
export const HOME_DEALS_PAGE_SIZE = 20;
export const HOME_BRAND_CARD_PRODUCTS = 3;
/** Bestseller category cards: how many categories, and the product images in each card's 2×2 grid */
export const BESTSELLER_CATEGORY_CARDS = 6;
export const BESTSELLER_CARD_IMAGES = 4;
/** A theme band holds one row of aisle tiles */
export const THEME_BAND_MIN_TILES = 2;
export const THEME_BAND_MAX_TILES = 4;
/** Store special cards Home shows, most recently updated first */
export const HOME_STORE_SPECIALS = 2;
/** Product images a tile without art shows as a pack cluster */
export const TILE_PACK_IMAGES = 3;
export const MAX_SEARCH_HINTS = 8;
/** Everyday searches that fill the search bar's rotation where a store's own searches run short */
export const DEFAULT_SEARCH_HINTS = ["milk", "atta", "onion", "eggs", "bread", "paneer", "chips", "detergent"];

/** Headline typefaces a festival hero can use; the designer picks one per festival, the app bundles them all */
export const FestiveFont = {
  PLAYFAIR: "PLAYFAIR",
  YATRA: "YATRA",
  KALAM: "KALAM",
  LOBSTER: "LOBSTER",
} as const;
export type FestiveFont = (typeof FestiveFont)[keyof typeof FestiveFont];
