import type { CollectionKind, SearchSortBy } from "../constants/index.js";
import type { WebLinkTile } from "./web-home.js";
import type { WebProductCard, WebShopStore } from "./web.js";

/** A search result: a product card, and the banner it was paid for through when it sits in an ad slot */
export type WebSearchCard = WebProductCard & { adBannerId?: string };

/** The results' tab row: aisles when the matches span several ("oil" → Sunflower, Groundnut…), else product tags */
export interface WebSearchTab {
  kind: "sub" | "tag";
  /** A subcategory slug or a tag */
  value: string;
  /** Short label for the tab; `name` is the full one */
  label: string;
  name: string;
  imageUrl: string | null;
  count: number;
}

export interface WebSearchFacets {
  tabs: WebSearchTab[];
  brands: { slug: string; name: string; imageUrl: string | null; count: number }[];
  sizes: { label: string; count: number }[];
  offerCount: number;
}

/** The filters a search ran with, as they sit in the page's URL */
export interface WebSearchFilters {
  sub?: string;
  tag?: string;
  brand: string[];
  size?: string;
  food?: string;
  offers: boolean;
  sort: SearchSortBy;
  exact: boolean;
}

export interface WebSearchPage {
  store: WebShopStore;
  q: string;
  products: WebSearchCard[];
  facets: WebSearchFacets | null;
  filters: WebSearchFilters;
  /** Set when the words searched differ from those typed: a spelling fix, or related terms */
  meta: { correctedQuery: string | null; expandedTerms: string[] | null } | null;
}

export interface WebSuggestion {
  text: string;
  kind: "query" | "category" | "brand";
  imageUrl: string | null;
  adBannerId?: string;
}

/** What /search shows before anything is typed */
export interface WebSearchLanding {
  store: WebShopStore;
  trending: string[];
  occasions: { kind: CollectionKind; title: string; subtitle: string | null; imageUrl: string | null; href: string; aisles: WebLinkTile[]; products: WebProductCard[] }[];
  timePicks: { period: "morning" | "afternoon" | "evening" | "night"; title: string; products: WebProductCard[] };
  categories: WebLinkTile[];
}
