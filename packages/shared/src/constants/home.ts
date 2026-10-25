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
  BUY_GET_DEALS: "BUY_GET_DEALS",
  HERO_CARDS: "HERO_CARDS",
  STORE_WALK: "STORE_WALK",
  MONTHLY_LIST: "MONTHLY_LIST",
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
  BUY_GET_DEALS: "Buy X get Y free",
  HERO_CARDS: "Hero cards",
  STORE_WALK: "Walk the store",
  MONTHLY_LIST: "Monthly list (in the shopper's reminder week)",
};

/** The tall cards the Home hero carousel can show, in their default order */
export const HeroCardKind = {
  FESTIVE: "FESTIVE",
  BUY_GET: "BUY_GET",
  MOST_BOUGHT: "MOST_BOUGHT",
  STORE_SPECIAL: "STORE_SPECIAL",
  RIGHT_NOW: "RIGHT_NOW",
  /** A collection the admin picks, in a palette they pick; can be added any number of times */
  COLLECTION: "COLLECTION",
} as const;
export type HeroCardKind = (typeof HeroCardKind)[keyof typeof HeroCardKind];
export const HERO_CARD_KINDS = Object.values(HeroCardKind);
/** The cards that fill themselves; each shows at most once */
export type FixedHeroCardKind = Exclude<HeroCardKind, "COLLECTION">;
export const FIXED_HERO_CARD_KINDS = HERO_CARD_KINDS.filter((k): k is FixedHeroCardKind => k !== "COLLECTION");

export const HeroCardKindLabels: Record<HeroCardKind, string> = {
  FESTIVE: "Live festival",
  BUY_GET: "Buy X get Y free",
  MOST_BOUGHT: "Most bought at the store",
  STORE_SPECIAL: "Store special",
  RIGHT_NOW: "Right now (by time of day)",
  COLLECTION: "Collection",
};

/** Parts of the day (IST) the "Right now" card switches its collection by */
export const DayPart = { morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" } as const;
export type DayPart = (typeof DayPart)[keyof typeof DayPart];
export const DAY_PARTS = Object.values(DayPart);

/**
 * A hero card's colours: the page wash fades from `tint` through `tintSoft` into the page, `ink` is the header's text and
 * the search bar's action colour (readable on the tint and on white), `card`/`cardInk` paint the card itself
 */
export interface HeroCardTheme { tint: string; tintSoft: string; ink: string; card: string; cardInk: string }

/** Looks an admin can give a collection card; the fixed cards wear the first four */
export const HeroCardPalette = {
  MINT: "MINT", LAVENDER: "LAVENDER", AMBER: "AMBER", SKY: "SKY", ROSE: "ROSE", SAFFRON: "SAFFRON", LIME: "LIME",
} as const;
export type HeroCardPalette = (typeof HeroCardPalette)[keyof typeof HeroCardPalette];
export const HERO_CARD_PALETTES: Record<HeroCardPalette, HeroCardTheme> = {
  MINT: { tint: "#bfe6de", tintSoft: "#e2f4f0", ink: "#115e59", card: "#b3ddd2", cardInk: "#115e59" },
  LAVENDER: { tint: "#ddd6fe", tintSoft: "#efebff", ink: "#4c1d95", card: "#d4c9fb", cardInk: "#4c1d95" },
  AMBER: { tint: "#fde68a", tintSoft: "#fef3c7", ink: "#78350f", card: "#fbe2a4", cardInk: "#78350f" },
  SKY: { tint: "#bae6fd", tintSoft: "#e0f2fe", ink: "#075985", card: "#b0daf5", cardInk: "#075985" },
  ROSE: { tint: "#fecdd3", tintSoft: "#ffe4e6", ink: "#9f1239", card: "#fbd0d6", cardInk: "#9f1239" },
  SAFFRON: { tint: "#fed7aa", tintSoft: "#ffedd5", ink: "#9a3412", card: "#fbcfa0", cardInk: "#9a3412" },
  LIME: { tint: "#d9f99d", tintSoft: "#ecfccb", ink: "#3f6212", card: "#d3f08f", cardInk: "#3f6212" },
};
export const HeroCardPaletteLabels: Record<HeroCardPalette, string> = {
  MINT: "Mint", LAVENDER: "Lavender", AMBER: "Amber", SKY: "Sky", ROSE: "Rose", SAFFRON: "Saffron", LIME: "Lime",
};

/** Fixed looks for the cards that have no designer theme; a festival card takes its colours from the festival */
export const HERO_CARD_THEMES: Record<Exclude<FixedHeroCardKind, "FESTIVE">, HeroCardTheme> = {
  BUY_GET: HERO_CARD_PALETTES.MINT,
  MOST_BOUGHT: HERO_CARD_PALETTES.LAVENDER,
  STORE_SPECIAL: HERO_CARD_PALETTES.AMBER,
  RIGHT_NOW: HERO_CARD_PALETTES.SKY,
};
function blend(hex: string, toward: string, amount: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [parse(hex), parse(toward)];
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A festival's designer theme as card colours; a dark festival still washes the page in a pale tint of its colour,
 * so the header and search bar always sit on light
 */
export function festivalCardTheme(theme: { background: string; title: string; dark: boolean }): HeroCardTheme {
  const page = "#f8fafc";
  if (!theme.dark) {
    // The card is shaded a touch towards the ink, so it stands off the wash of the same colour
    return {
      tint: theme.background, tintSoft: blend(theme.background, page, 0.5),
      ink: theme.title, card: blend(theme.background, theme.title, 0.08), cardInk: theme.title,
    };
  }
  return {
    tint: blend(theme.background, page, 0.78), tintSoft: blend(theme.background, page, 0.9),
    ink: theme.background, card: theme.background, cardInk: theme.title,
  };
}
/** Products a buy X get Y card lists, and the fewest offers worth a card */
export const HERO_BUY_GET_PRODUCTS = 4;
export const HERO_BUY_GET_MIN = 3;
/** Products a most-bought card lists; it needs them all */
export const HERO_MOST_BOUGHT_PRODUCTS = 4;
/** The full most-bought list its card's "View all" opens */
export const MOST_BOUGHT_LIST = 30;
/** Products the "Right now" card lists, and the fewest worth a card */
export const HERO_RIGHT_NOW_PRODUCTS = 4;
export const HERO_RIGHT_NOW_MIN = 3;
/** Products a collection card lists, and the fewest worth a card */
export const HERO_COLLECTION_PRODUCTS = 4;
export const HERO_COLLECTION_MIN = 3;
/** One card is a banner, not a carousel */
export const HERO_MIN_CARDS = 2;

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
/** Buy X get Y offers: the Home row, and each page of the full list */
export const HOME_BUY_GET_ROW = 10;
export const BUY_GET_PAGE_SIZE = 20;
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
/** The everyday searches in other languages, by language */
export const DEFAULT_SEARCH_HINT_TRANSLATIONS: Record<string, Record<string, string>> = {
  ta: { milk: "பால்", atta: "ஆட்டா", onion: "வெங்காயம்", eggs: "முட்டை", bread: "பிரெட்", paneer: "பனீர்", chips: "சிப்ஸ்", detergent: "சோப்புத் தூள்" },
};

/** Headline typefaces a festival hero can use; the designer picks one per festival, the app bundles them all */
export const FestiveFont = {
  PLAYFAIR: "PLAYFAIR",
  YATRA: "YATRA",
  KALAM: "KALAM",
  LOBSTER: "LOBSTER",
} as const;
export type FestiveFont = (typeof FestiveFont)[keyof typeof FestiveFont];
