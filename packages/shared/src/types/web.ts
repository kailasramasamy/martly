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

/** Everything martlyshop.in's home page renders */
export interface WebHome {
  towns: WebTown[];
  departments: WebDepartment[];
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

export interface WebCategoryPage {
  store: WebShopStore;
  department: WebCategoryLink;
  category: WebCategoryLink;
  subcategories: (WebCategoryLink & { count: number })[];
  /** The subcategory filter in use */
  subcategory: string | null;
  products: WebProductCard[];
  page: number;
  totalPages: number;
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
