import type { FestiveFont, HomeSectionType, SectionHeaderStyle, TabRailStyle } from "../constants/home.js";

type Translations = Record<string, { title?: string; subtitle?: string }> | null;
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
  section: { title: string | null; headline: string | null; bands: PriceBand[] };
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
    tiles: { categoryId: string; name: string; translations: NameTranslations; imageUrl: string | null; wide: boolean }[];
  }[];
}

export interface TileGridSection extends HomeSectionBase {
  type: "EXPLORE_GRID" | "STORE_GRID";
  tiles: { id: string; label: string; imageUrl: string | null; wide: boolean; collectionId: string | null }[];
}

/** Built-in blocks; `data` carries the same shape the legacy feed used for that block */
export interface SystemSection extends HomeSectionBase {
  type: Exclude<HomeSectionType,
    "PRODUCT_ROW" | "CAMPAIGN_CARD" | "TABBED_ROW" | "PRICE_BAND_DEALS" | "BRAND_CARD" | "CATEGORY_DIRECTORY" | "EXPLORE_GRID" | "STORE_GRID">;
  data: Record<string, unknown>;
}

export type HomeSection<P = unknown> =
  | ProductRowSection<P>
  | CampaignCardSection<P>
  | TabbedRowSection<P>
  | PriceBandDealsSection<P>
  | BrandCardSection<P>
  | CategoryDirectorySection
  | TileGridSection
  | SystemSection;

/** Page-level settings sent with the first page of sections */
export interface HomeChrome {
  /** Festive theme for the header while a festival hero leads the page */
  headerTheme: HomeTheme | null;
  searchHints: string[];
  /** Cart total that unlocks free delivery; null when delivery is already free for this shopper */
  freeDeliveryThreshold: number | null;
  popup: Record<string, unknown> | null;
}

export interface HomeSectionsPage<P = unknown> {
  sections: HomeSection<P>[];
  nextCursor: string | null;
  chrome?: HomeChrome;
}
