import { z } from "zod";
import { FESTIVAL_REGIONS } from "../constants/index.js";

export const BRAND_RANKING_LEVELS = ["category", "subcategory"] as const;
export type BrandRankingLevel = (typeof BRAND_RANKING_LEVELS)[number];

/** A region code, or ALL for the order every region falls back to */
export const brandRankingRegionSchema = z.enum(Object.keys(FESTIVAL_REGIONS) as [keyof typeof FESTIVAL_REGIONS]);

/** Martly's brand order in one category or subcategory for one region, most popular first */
export const brandRankingSchema = z.object({
  region: brandRankingRegionSchema,
  brandIds: z.array(z.string().uuid()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "Each brand once"),
});
export type BrandRankingInput = z.infer<typeof brandRankingSchema>;
