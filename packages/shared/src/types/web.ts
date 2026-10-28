import type { FoodType, SearchSortBy } from "../constants/index.js";
import type { PriceRange } from "../constants/browse.js";
import type { StoreSize } from "../constants/onboarding.js";

/** A live store as the public website lists it: only what a shopper sees before signing in */
export interface WebStore {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  address: string;
  imageUrl: string | null;
  logoUrl: string | null;
  size: StoreSize | null;
}

export interface WebTown {
  name: string;
  slug: string;
  district: string;
  state: string;
  stores: WebStore[];
}

export interface WebDepartment {
  name: string;
  slug: string;
  imageUrl: string | null;
}

/** A store's public page: the store and the town it serves */
export interface WebStorePage {
  store: WebStore;
  town: Omit<WebTown, "stores">;
}

/** Live towns and their stores, for the store picker and footer on every page */
export interface WebHome {
  towns: WebTown[];
}

/** The store martlyshop.in shows prices and stock from, picked for the shopper as in the app */
export interface WebShopStore {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  town: { name: string; slug: string };
}

/** One pack size of a product at the store, e.g. "1 kg" */
export interface WebPack {
  id: string;
  name: string;
  price: number;
  /** Struck-through price, when the shopper pays less than it */
  mrp: number | null;
  offPercent: number;
  inStock: boolean;
  /** Buy X get Y free, while it runs */
  offer: { buy: number; get: number } | null;
  /** The store's own printed pack for this size, when it packs the product itself */
  imageUrl: string | null;
}

export interface WebProductCard {
  slug: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  packs: WebPack[];
}

export interface WebCategoryLink {
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface WebDepartmentTree extends WebDepartment {
  categories: WebCategoryLink[];
}

/** A row of products under a heading that links to the full list */
export interface WebShelf {
  name: string;
  path: string;
  products: WebProductCard[];
}

export interface WebDepartmentPage {
  store: WebShopStore;
  department: WebDepartmentTree;
  shelves: WebShelf[];
}

/** A filtered product list: subcategory chips, the shopper's filters with their facets, a page of products */
export interface WebFilteredList {
  subcategories: (WebCategoryLink & { count: number })[];
  /** The subcategory filter in use */
  subcategory: string | null;
  products: WebProductCard[];
  /** Products that match the filters, across pages */
  total: number;
  filters: WebCategoryFilters;
  facets: WebCategoryFacets;
  page: number;
  totalPages: number;
}

export interface WebCategoryPage extends WebFilteredList {
  store: WebShopStore;
  department: WebCategoryLink;
  category: WebCategoryLink;
}

export interface WebBrandPage extends WebFilteredList {
  store: WebShopStore;
  brand: { name: string; slug: string; imageUrl: string | null };
}

export interface WebBrandTile {
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string | null;
  productCount: number;
  /** Slugs of the departments the brand's products sit in */
  departments: string[];
}

/** Every brand the store stocks, A to Z, with the best known ones picked out */
export interface WebBrandsPage {
  store: WebShopStore;
  brands: WebBrandTile[];
  /** Slugs of the brands shoppers know best, most known first */
  popular: string[];
  /** The departments the brands cover, in store order */
  departments: WebDepartment[];
}

/** The filters in use on a category page; null or empty when off */
export interface WebCategoryFilters {
  brand: string[];
  price: PriceRange | null;
  off: number | null;
  rating: number | null;
  offers: boolean;
  food: FoodType | null;
  stock: boolean;
  sort: SearchSortBy;
}

/** What each filter group can pick, counted with every other group's filter applied (Amazon's rule) */
export interface WebCategoryFacets {
  brands: { slug: string; name: string; imageUrl: string | null; count: number }[];
  /** Bands sized to the category's prices; the last has no max */
  priceBands: (PriceRange & { count: number })[];
  discounts: { min: number; count: number }[];
  ratings: { min: number; count: number }[];
  offerCount: number;
  foodTypes: { type: FoodType; count: number }[];
  inStockCount: number;
}

export interface WebProductPage {
  store: WebShopStore;
  product: Omit<WebProductCard, "packs"> & {
    description: string | null;
    images: string[];
    foodType: string | null;
    details: { label: string; value: string }[];
    /** Department → category → subcategory, for breadcrumbs */
    trail: { name: string; path: string }[];
  };
  /** Empty when this store doesn't sell it */
  packs: WebPack[];
  related: WebProductCard[];
}

export interface WebSitemap {
  departments: string[];
  categories: { slug: string; department: string }[];
  products: { slug: string; updatedAt: string }[];
  collections: string[];
  brands: string[];
}
