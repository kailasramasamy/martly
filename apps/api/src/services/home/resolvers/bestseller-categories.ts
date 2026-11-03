import { BESTSELLER_CARD_IMAGES, BESTSELLER_CATEGORY_CARDS, NATIONAL_REGION } from "@martly/shared/constants";
import type { BestsellerCategoriesSection } from "@martly/shared/types";
import { rankingRegions, storeRegion } from "../../brand-popularity.js";
import { recentStoreSales } from "../most-bought.js";
import { sectionBase, type SectionResolver } from "../types.js";

// Fewer than one row of cards reads as a gap, not a shelf
const MIN_CARDS = 3;

type Row = { id: string; name: string; translations: BestsellerCategoriesSection["categories"][number]["translations"]; images: string[]; stocked: number };

/**
 * Categories ranked by units sold at this store over 30 days (then by how much they stock), each pictured by its own
 * top sellers, cut out where possible so the pack fills its tile. Every product counted is active and in stock here,
 * so a card never shows what can't be bought. A brand Martly has ranked in the category leads with its best pack, the
 * one picked for category tiles if it has one.
 */
export const bestsellerCategories: SectionResolver = async (ctx, entry) => {
  const regions = rankingRegions(await storeRegion(ctx.prisma, ctx.store.id));
  const rows = await ctx.prisma.$queryRaw<Row[]>`
    WITH stocked AS (
      SELECT p.id, COALESCE(p.pack_cutout_url, p.cutout_url, p.image_url) AS image_url, p.pack_cutout_url, p.cutout_url, p.brand_id, s.category_id, COALESCE(sales.qty, 0) AS qty, SUM(sp.stock) AS stock,
        (SELECT r.popularity FROM brand_category_popularity r
          WHERE r.brand_id = p.brand_id AND r.category_id = s.category_id AND r.region = ANY(${regions}::text[])
          ORDER BY r.region = ${NATIONAL_REGION} LIMIT 1) AS brand_rank
      FROM products p
      JOIN subcategories s ON s.id = p.subcategory_id
      JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0
      LEFT JOIN (${recentStoreSales(ctx.store.id)}) sales ON sales.product_id = p.id
      WHERE p.is_active
      GROUP BY p.id, p.image_url, p.pack_cutout_url, p.cutout_url, p.brand_id, s.category_id, sales.qty
    ),
    by_brand AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY category_id, brand_id ORDER BY pack_cutout_url IS NOT NULL DESC, qty DESC, cutout_url IS NOT NULL DESC, stock DESC, id) AS brand_turn FROM stocked
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY category_id
        ORDER BY CASE WHEN brand_turn = 1 THEN brand_rank END DESC NULLS LAST, qty DESC, cutout_url IS NOT NULL DESC, stock DESC, id
      ) AS rank FROM by_brand
    )
    SELECT c.id, c.name, c.translations,
      (ARRAY_AGG(r.image_url ORDER BY r.rank) FILTER (WHERE r.image_url IS NOT NULL))[1:${BESTSELLER_CARD_IMAGES}] AS images,
      COUNT(*)::int AS stocked
    FROM ranked r JOIN categories c ON c.id = r.category_id
    GROUP BY c.id, c.name, c.translations
    HAVING COUNT(r.image_url) >= ${BESTSELLER_CARD_IMAGES}
    ORDER BY SUM(r.qty) DESC, COUNT(*) DESC, c.name
    LIMIT ${BESTSELLER_CATEGORY_CARDS}`;
  if (rows.length < MIN_CARDS) return null;
  const categories = rows.map(({ id, name, translations, images, stocked }) => ({
    id, name, translations, images, more: Math.max(0, stocked - images.length),
  }));
  return { ...sectionBase(entry), type: "BESTSELLER_CATEGORIES", categories };
};
