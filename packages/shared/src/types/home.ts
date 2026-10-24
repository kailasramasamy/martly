import type { FestiveFont, HomeSectionType, SectionHeaderStyle, TabRailStyle } from "../constants/home.js";

/** A section's text in other languages; the config-driven labels (headline, bands, offer) translate here too */
type Translations = Record<string, {
  title?: string;
  subtitle?: string;
  headline?: string;
  offerLabel?: string;
  /** In the order of the section's bands */
  bandLabels?: string[];
}> | null;
type NameTranslations = Record<string, { name?: string }> | null;

/** Where a section's "See all" leads: a collection (optionally narrowed to aisles) or an app path */
export type HomeSeeAll = { collectionId: string; subcategoryIds?: string[] } | { href: string };

export interface HomeSectionBase {
  id: string;
  title: string | null;
  subtitle: string | null;
  translations: Translations;
  seeAll?: HomeSeeAll;
}

export interface HomeTheme {
  background: string;
  title: string;
  dark: boolean;
  /** The festival hero's headline typeface; absent means the default (Playfair Display) */
  font?: FestiveFont;
}

/** A horizontal product row with one of three header looks */
export interface ProductRowSection<P> extends HomeSectionBase {
  type: "PRODUCT_ROW";
  header: { style: SectionHeaderStyle; imageUrl: string | null; tint: string | null };
  products: P[];
  total: number;
}

export interface CampaignTile {
  id: string;
  label: string;
  /** The label in other languages, keyed by language code */
  translations?: Record<string, { label?: string }> | null;
  subcategoryIds: string[];
  /** Up to 3 product images, drawn as an overlapping pack cluster */
  images: string[];
  productCount: number;
}

/** A themed promotion block: art, offer, title and aisle tiles that open the collection narrowed to that aisle */
export interface CampaignCardSection<P> extends HomeSectionBase {
  type: "CAMPAIGN_CARD";
  collectionId: string;
  offerLabel: string | null;
  imageUrl: string | null;
  theme: HomeTheme;
  tiles: CampaignTile[];
  /** A few standout products for the card's showcase */
  highlights: P[];
  productCount: number;
  /** When the offer ends (ISO), for a countdown; null when open-ended */
  endsAt: string | null;
}

export interface HomeTab {
  id: string;
  label: string;
  translations: Record<string, { label: string }> | null;
  imageUrl: string | null;
  collectionId: string;
}

/** A product row switched between collections by a tab rail */
export interface TabbedRowSection<P> extends HomeSectionBase {
  type: "TABBED_ROW";
  tabStyle: TabRailStyle;
  /** The panel colour the tabs open onto; null uses the app's default */
  tint: string | null;
  tabs: HomeTab[];
  /** Products of the first tab; the others load from the collection when picked */
  products: P[];
  total: number;
}

export interface PriceBandChip {
  categoryId: string;
  label: string;
  translations: NameTranslations;
  imageUrl: string | null;
}

/** Products under a price ("Under \u20B919"), narrowed by category chips; other bands load from `/home/:storeId/deals` */
export interface PriceBandDealsSection<P> extends HomeSectionBase {
  type: "PRICE_BAND_DEALS";
  headline: string | null;
  bands: PriceBand[];
  /** Categories with products in the first band */
  chips: PriceBandChip[];
  products: P[];
  total: number;
}

export interface PriceBand {
  id: string;
  label: string;
  maxPrice: number | null;
}

/** One band and chip's products, from `GET /home/:storeId/deals` */
export interface PriceBandPage<P = unknown> {
  chips: PriceBandChip[];
  products: P[];
  total: number;
}

/** A deals page with the section it belongs to, so the full Deals screen can open on its own */
export interface PriceBandDealsPage<P = unknown> extends PriceBandPage<P> {
  section: { title: string | null; headline: string | null; bands: PriceBand[]; translations: Translations };
}

export interface BrandCardSection<P> extends HomeSectionBase {
  type: "BRAND_CARD";
  brand: { id: string; name: string; logoUrl: string | null; themeColor: string | null };
  imageUrl: string | null;
  tint: string | null;
  products: P[];
}

export interface CategoryDirectorySection extends HomeSectionBase {
  type: "CATEGORY_DIRECTORY";
  groups: {
    departmentId: string;
    name: string;
    translations: NameTranslations;
    tiles: { categoryId: string; name: string; translations: NameTranslations; imageUrl: string | null }[];
  }[];
}

/** The store's best-selling categories, each shown through its own best sellers */
export interface BestsellerCategoriesSection extends HomeSectionBase {
  type: "BESTSELLER_CATEGORIES";
  categories: {
    id: string;
    name: string;
    translations: NameTranslations;
    /** Images of the category's top sellers at this store, best first */
    images: string[];
    /** In-stock products beyond those pictured */
    more: number;
  }[];
}

export interface GridTile {
  id: string;
  label: string;
  translations: Record<string, { label: string }> | null;
  /** The tile's art, else its collection's image; null falls back to `packImages` */
  imageUrl: string | null;
  /** Up to 3 of the collection's in-stock product images, for a pack cluster */
  packImages: string[];
  wide: boolean;
  collectionId: string;
  /** Aisles the tile narrows its collection to; empty opens the whole collection */
  subcategoryIds: string[];
}

/** Tiles that each open a collection: "Explore" themes, or "Shop by store" mini-stores with a storefront look */
export interface TileGridSection extends HomeSectionBase {
  type: "EXPLORE_GRID" | "STORE_GRID";
  tiles: GridTile[];
}

/** A pastel band between shelves: a themed title and art over a row of aisle tiles, each opening one aisle */
export interface ThemeBandSection extends HomeSectionBase {
  type: "THEME_BAND";
  tint: string;
  imageUrl: string | null;
  tiles: { id: string; label: string; translations: NameTranslations; imageUrl: string | null; subcategoryId: string }[];
}

/** A store's own ranges (its bakery, its sweets) as the search screen's spotlight cards; `P` is the product shape */
export interface StoreSpecialsSection<P> extends HomeSectionBase {
  type: "STORE_SPECIALS";
  collections: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    kind: string;
    translations: unknown;
    imageUrl: string | null;
    imageUrls: Record<string, string> | null;
    textInImage: boolean;
    subcategories: { id: string; name: string; translations: unknown }[];
    products: P[];
  }[];
}

/** The Categories tab: every stocked department as a tile directory, then the org's Shop by store grid */
export interface CategoryDirectoryPage {
  groups: CategoryDirectorySection["groups"];
  stores: TileGridSection | null;
}

/** Built-in blocks; `data` carries the same shape the legacy feed used for that block */
export interface SystemSection extends HomeSectionBase {
  type: Exclude<HomeSectionType,
    "PRODUCT_ROW" | "CAMPAIGN_CARD" | "TABBED_ROW" | "PRICE_BAND_DEALS" | "BRAND_CARD" | "CATEGORY_DIRECTORY" | "EXPLORE_GRID" | "STORE_GRID"
    | "BESTSELLER_CATEGORIES" | "THEME_BAND" | "STORE_SPECIALS">;
  data: Record<string, unknown>;
}

export type HomeSection<P = unknown> =
  | ProductRowSection<P>
  | CampaignCardSection<P>
  | TabbedRowSection<P>
  | PriceBandDealsSection<P>
  | BrandCardSection<P>
  | CategoryDirectorySection
  | BestsellerCategoriesSection
  | ThemeBandSection
  | StoreSpecialsSection<P>
  | TileGridSection
  | SystemSection;

/** An advertised coupon as the shopper sees it: on Home's offer cards and in checkout's offer list */
export interface CouponOffer {
  code: string;
  /** Headline, e.g. "Flat \u20B950 off"; made from the discount when the coupon has none */
  title: string;
  description: string | null;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  expiresAt: string | null;
  /** With a cart amount: whether it applies now, else what's missing */
  eligible: boolean;
  /** Cart amount still needed to unlock it */
  shortBy: number | null;
  /** What the coupon takes off the given cart amount, when it applies */
  discount: number | null;
}

/** Page-level settings sent with the first page of sections */
export interface HomeChrome {
  /** Festive theme for the header while a festival hero leads the page */
  headerTheme: HomeTheme | null;
  /** What the search bar cycles through: festival aisles, the store's popular searches, then everyday ones */
  searchHints: string[];
  /** Cart total that unlocks free delivery; null when delivery is already free for this shopper */
  freeDeliveryThreshold: number | null;
}

export interface HomeSectionsPage<P = unknown> {
  sections: HomeSection<P>[];
  nextCursor: string | null;
  chrome?: HomeChrome;
}
