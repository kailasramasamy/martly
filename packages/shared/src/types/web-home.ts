import type { DayPart, HeroCardTheme, SectionHeaderStyle, TabRailStyle } from "../constants/home.js";
import type { HomeTheme } from "./home.js";
import type { WebProductCard, WebShopStore, WebStore, WebTown } from "./web.js";

/**
 * The app's Home sections as martlyshop.in draws them: products are web cards (P) and every tap target is a site path.
 * Sections that need an account or an app-only feature aren't sent.
 */
export interface WebSectionBase {
  id: string;
  title: string | null;
  subtitle: string | null;
  /** "See all"; null when the section has nowhere to go */
  href: string | null;
}

export interface WebLinkTile {
  label: string;
  imageUrl: string | null;
  href: string;
}

/** A filter a list can switch to in place: its label and query value (a band's index, a category slug) */
export interface WebFilter {
  label: string;
  value: string;
}

export interface WebHeroCard<P> {
  id: string;
  kind: "FESTIVE" | "BUY_GET" | "MOST_BOUGHT" | "STORE_SPECIAL" | "RIGHT_NOW" | "COLLECTION";
  theme: HeroCardTheme;
  kicker: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  products: P[];
  total: number;
  tiles: WebLinkTile[];
  dayPart?: DayPart;
}

export interface WebFestiveSlide {
  id: string;
  title: string;
  kicker: string | null;
  subtitle: string | null;
  imageUrl: string;
  theme: HomeTheme;
  href: string;
  tiles: WebLinkTile[];
}

export interface WebBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  /** The art carries its own words, so none are drawn over it */
  textInImage: boolean;
  href: string | null;
}

export type WebHomeSection<P = WebProductCard> = WebSectionBase & (
  | { type: "HERO_CARDS"; cards: WebHeroCard<P>[] }
  | { type: "FESTIVE_HERO"; slides: WebFestiveSlide[] }
  | { type: "HERO_BANNERS" | "BRAND_POSTERS"; banners: WebBanner[] }
  | { type: "DEPARTMENT_GRID"; tiles: WebLinkTile[] }
  | { type: "CATEGORY_DIRECTORY"; groups: (WebLinkTile & { tiles: WebLinkTile[] })[] }
  | { type: "BESTSELLER_CATEGORIES"; categories: (WebLinkTile & { images: string[]; more: number })[] }
  | { type: "PRODUCT_ROW"; header: { style: SectionHeaderStyle; imageUrl: string | null; tint: string | null }; products: P[]; total: number }
  | { type: "TABBED_ROW"; tabStyle: TabRailStyle; tint: string | null; tabs: (WebLinkTile & { slug: string })[]; products: P[]; total: number }
  | { type: "THEME_BAND"; tint: string; imageUrl: string | null; tiles: WebLinkTile[] }
  | { type: "PRICE_BAND_DEALS"; headline: string | null; bands: WebFilter[]; chips: (WebFilter & { imageUrl: string | null })[]; products: P[]; total: number }
  | { type: "EXPLORE_GRID" | "STORE_GRID"; tiles: (WebLinkTile & { packImages: string[]; wide: boolean })[] }
  | { type: "BRAND_RAIL"; brands: (WebLinkTile & { themeColor: string | null })[] }
  | { type: "BRAND_CARD"; brand: { name: string; logoUrl: string | null; themeColor: string | null }; imageUrl: string | null; tint: string | null; products: P[] }
  | { type: "TIME_PICKS"; dayPart: DayPart; categories: (WebLinkTile & { products: P[] })[] }
  | { type: "BUY_GET_DEALS" | "DEALS"; products: P[]; total: number }
  | {
      type: "CAMPAIGN_CARD"; offerLabel: string | null; imageUrl: string | null; theme: HomeTheme;
      tiles: (WebLinkTile & { images: string[]; productCount: number })[]; highlights: P[]; productCount: number; endsAt: string | null;
    }
  | { type: "STORE_SPECIALS"; collections: { title: string; subtitle: string | null; imageUrl: string | null; href: string; aisles: WebLinkTile[]; products: P[] }[] }
);

/** What Home's store header says about the store: its own look and words, and facts a shopper weighs */
export interface WebStoreProfile {
  brandColor: string | null;
  tagline: string | null;
  offerText: string | null;
  address: string;
  freeDeliveryAbove: number | null;
  rating: { average: number; count: number } | null;
  deals: { count: number; maxPercent: number } | null;
  delivery: WebStoreDelivery;
}

/** How soon the store delivers: express while it is open, else its next slot; times are "HH:MM" IST */
export interface WebStoreDelivery {
  expressMinutes: number | null;
  hours: { opens: string; closes: string } | null;
  /** Null when the store has no hours set */
  openNow: boolean | null;
  /** Today's date in IST, so the page can say "Today" or "Tomorrow" */
  today: string;
  nextSlot: { date: string; startTime: string; endTime: string } | null;
}

/** A live store on its town's page at martlyshop.in/{town}: its shopfront and what ordering from it is like */
export interface WebTownStore extends WebStore, Pick<WebStoreProfile, "brandColor" | "offerText" | "freeDeliveryAbove" | "rating" | "deals" | "delivery"> {
  /** Its first live Home cover banner, else its storefront photo */
  coverUrl: string | null;
  productCount: number;
}

export interface WebTownPage {
  town: Omit<WebTown, "stores">;
  stores: WebTownStore[];
}

export interface WebHomeSectionsPage {
  store: WebShopStore;
  /** On the first page only */
  profile: WebStoreProfile | null;
  sections: WebHomeSection[];
  nextCursor: string | null;
}

/** A collection or festival's page: its art and look, aisle chips, and a page of products */
export interface WebCollectionPage {
  store: WebShopStore;
  collection: { title: string; subtitle: string | null; slug: string; imageUrl: string | null; endsAt: string | null; theme: HomeTheme | null; offerLabel: string | null };
  aisles: (WebLinkTile & { slug: string; active: boolean })[];
  products: WebProductCard[];
  page: number;
  totalPages: number;
}

export type WebFilterLink = WebLinkTile & WebFilter & { active: boolean };

/** A full list behind a Home row: buy X get Y, best sellers, a price band's deals, or a brand */
export interface WebListPage {
  store: WebShopStore;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** Category chips, then a price band's bands, each a link that can also switch in place */
  chips: WebFilterLink[];
  bands?: WebFilterLink[];
  products: WebProductCard[];
  page: number;
  totalPages: number;
}
