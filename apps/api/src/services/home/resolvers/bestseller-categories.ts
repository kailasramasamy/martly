import { BESTSELLER_CARD_IMAGES, BESTSELLER_CATEGORY_CARDS } from "@martly/shared/constants";
import type { BestsellerCategoriesSection } from "@martly/shared/types";
import { recentStoreSales } from "../most-bought.js";
import { sectionBase, type SectionResolver } from "../types.js";

// Fewer than one row of cards reads as a gap, not a shelf
const MIN_CARDS = 3;

type Row = { id: string; name: string; translations: BestsellerCategoriesSection["categories"][number]["translations"]; images: string[]; stocked: number };

/**
 * Categories ranked by units sold at this store over 30 days (then by how much they stock), each pictured by its own
 * top sellers. Every product counted is active and in stock here, so a card never shows what can't be bought.
 */
export const bestsellerCategories: SectionResolver = async (ctx, entry) => {
  const rows = await ctx.prisma.$queryRaw<Row[]>`
    WITH stocked AS (
      SELECT p.id, p.image_url, s.category_id, COALESCE(sales.qty, 0) AS qty, SUM(sp.stock) AS stock
      FROM products p
      JOIN subcategories s ON s.id = p.subcategory_id
      JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0
      LEFT JOIN (${recentStoreSales(ctx.store.id)}) sales ON sales.product_id = p.id
      WHERE p.is_active
      GROUP BY p.id, p.image_url, s.category_id, sales.qty
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY qty DESC, stock DESC, id) AS rank FROM stocked
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
