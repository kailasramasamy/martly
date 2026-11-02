/**
 * Where a brand's score in a category comes from: ranked here (this level and region), the All India ranking at this
 * level, the category's ranking (on a subcategory), or the brand's own regional or national popularity
 */
export type BrandRankingSource = "here" | "allIndia" | "category" | "region" | "national";

/** A brand sold in a category or subcategory, in its effective order there */
export interface BrandRankingRow {
  id: string;
  name: string;
  imageUrl: string | null;
  products: number;
  popularity: number;
  source: BrandRankingSource;
}
