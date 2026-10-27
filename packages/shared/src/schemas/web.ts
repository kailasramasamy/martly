import { z } from "zod";
import { DISCOUNT_TIERS, FoodType, parsePriceRange, RATING_TIERS, SearchEventType, SearchSortBy } from "../constants/index.js";

/** martlyshop.in pages: the shopper's store (from a cookie, so a stale or bad one is ignored) and their town */
export const webShopQuerySchema = z.object({
  store: z.string().uuid().optional().catch(undefined),
  town: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  sub: z.string().trim().max(120).optional(),
  q: z.string().trim().max(100).optional(),
  /** Home's next page of sections */
  cursor: z.string().max(200).optional(),
  /** Collection page filters: aisle (subcategory) slugs, comma separated, or a festival tile */
  aisle: z.string().trim().max(400).optional(),
  tile: z.string().uuid().optional().catch(undefined),
  /** List page filters: a price band's index and a category slug */
  band: z.coerce.number().int().min(0).max(4).default(0).catch(0),
  category: z.string().trim().max(120).optional(),
  /** Search filters: a tag tab, brand slugs (comma separated), a pack size, food type, offers only, sort, words as typed */
  tag: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(600).optional().transform((v) => (v ? v.split(",").filter(Boolean).slice(0, 20) : [])),
  size: z.string().trim().max(60).optional(),
  food: z.nativeEnum(FoodType).optional().catch(undefined),
  offers: z.literal("1").optional().catch(undefined).transform(Boolean),
  sort: z.nativeEnum(SearchSortBy).default(SearchSortBy.RELEVANCE).catch(SearchSortBy.RELEVANCE),
  exact: z.literal("1").optional().catch(undefined).transform(Boolean),
  /** Category page filters: a price range ("50-100"), a "% off or more" tier, a "★ & up" tier, in stock only */
  price: z.string().max(20).optional().transform(parsePriceRange),
  off: z.coerce.number().refine((n) => (DISCOUNT_TIERS as readonly number[]).includes(n)).optional().catch(undefined),
  rating: z.coerce.number().refine((n) => (RATING_TIERS as readonly number[]).includes(n)).optional().catch(undefined),
  stock: z.literal("1").optional().catch(undefined).transform(Boolean),
});
export type WebShopQuery = z.infer<typeof webShopQuerySchema>;

/** A search martlyshop.in ran, logged for trending and ranking; the site's server sends it for the visitor */
export const webSearchLogSchema = z.object({
  storeId: z.string().uuid(),
  query: z.string().trim().toLowerCase().min(2).max(100),
  resultCount: z.number().int().min(0),
});

/** A result opened or added from a logged search, by product slug */
export const webSearchEventSchema = z.object({
  searchLogId: z.string().uuid(),
  product: z.string().trim().min(1).max(200),
  type: z.nativeEnum(SearchEventType),
  position: z.number().int().min(0),
});
