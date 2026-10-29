/** One segment of a shop's web address, a town or a store: lowercase letters and digits, hyphens only between them, 2–30 characters */
export const URL_SEGMENT_RULE = {
  pattern: /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/,
  message: "2–30 lowercase letters, numbers or hyphens, starting and ending with a letter or number",
};

/** Top-level paths on onmartly.in that a town can't take, since a town's slug is the first path segment */
export const RESERVED_TOWN_SLUGS = [
  "about", "account", "admin", "api", "app", "assets", "blog", "cart", "checkout", "contact", "help", "login",
  "logout", "martly", "orders", "privacy", "search", "signup", "static", "stores", "support", "terms", "www",
] as const;

/** martlyshop.in, where a store on a paid plan has its web store at /{town}/{store} */
export const SHOP_SITE_URL = "https://www.martlyshop.in";
export const webStoreUrl = (town: string, store: string) => `${SHOP_SITE_URL}/${town}/${store}`;
