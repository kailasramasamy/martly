import { HOME_DEALS_PAGE_SIZE } from "@martly/shared/constants";
import type { PriceBandChip, PriceBandPage } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { enrichStoreProduct, STORE_PRODUCT_INCLUDE } from "../store-feed.js";

export interface BandFilter {
  storeId: string;
  /** Narrows to a collection's products; null searches the store's whole catalog */
  collectionId: string | null;
  /** Null takes any price */
  maxPrice: number | null;
  categoryId?: string;
  now: Date;
}

// The price a shopper pays for a store row, as calculateEffectivePrice works it out: the store's live discount wins
// over the size's own
function discounted(alias: "sp" | "v", now: Date) {
  const t = Prisma.raw(alias);
  return Prisma.sql`
    WHEN ${t}.discount_type IS NOT NULL AND ${t}.discount_value > 0
      AND (${t}.discount_start IS NULL OR ${t}.discount_start <= ${now})
      AND (${t}.discount_end IS NULL OR ${t}.discount_end >= ${now})
    THEN CASE WHEN ${t}.discount_type::text = 'FLAT' THEN GREATEST(0, sp.price - ${t}.discount_value)
              ELSE GREATEST(0, sp.price * (1 - ${t}.discount_value / 100)) END`;
}

// In-stock store rows within the band, with the category their product sits in
function bandRows(f: BandFilter) {
  return Prisma.sql`
    WITH priced AS (
      SELECT sp.id, sp.product_id, sp.price, s.category_id,
        CASE ${discounted("sp", f.now)} ${discounted("v", f.now)} ELSE sp.price END AS paid
      FROM store_products sp
      JOIN product_variants v ON v.id = sp.variant_id
      JOIN products p ON p.id = sp.product_id AND p.is_active
      JOIN subcategories s ON s.id = p.subcategory_id
      WHERE sp.store_id = ${f.storeId} AND sp.is_active AND sp.stock > 0
        AND (${f.collectionId === null} OR EXISTS (
          SELECT 1 FROM collection_items ci WHERE ci.collection_id = ${f.collectionId ?? ""} AND ci.product_id = p.id))
    )
    SELECT * FROM priced WHERE (${f.maxPrice === null} OR paid <= ${f.maxPrice ?? 0})`;
}

/** Categories with products in the band, the busiest first */
export async function bandChips(prisma: PrismaClient, f: BandFilter): Promise<PriceBandChip[]> {
  const rows = await prisma.$queryRaw<{ category_id: string }[]>`
    SELECT category_id FROM (${bandRows(f)}) band
    GROUP BY category_id ORDER BY COUNT(DISTINCT product_id) DESC, category_id LIMIT 12`;
  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((r) => r.category_id) } },
    select: { id: true, name: true, translations: true, imageUrl: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  return rows.flatMap(({ category_id }) => {
    const c = byId.get(category_id);
    return c ? [{ categoryId: c.id, label: c.name, translations: c.translations as PriceBandChip["translations"], imageUrl: c.imageUrl }] : [];
  });
}

/** One page of the band's products, the biggest saving first; each carries only its sizes within the band */
export async function bandProducts(prisma: PrismaClient, f: BandFilter, page: number) {
  const ranked = await prisma.$queryRaw<{ product_id: string; ids: string[]; total: number }[]>`
    SELECT product_id, array_agg(id ORDER BY paid) AS ids, COUNT(*) OVER()::int AS total
    FROM (${bandRows(f)}) band
    WHERE (${!f.categoryId} OR category_id = ${f.categoryId ?? ""})
    GROUP BY product_id
    ORDER BY MAX(1 - paid / NULLIF(price, 0)) DESC, MIN(paid), product_id
    LIMIT ${HOME_DEALS_PAGE_SIZE} OFFSET ${(page - 1) * HOME_DEALS_PAGE_SIZE}`;
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: ranked.flatMap((r) => r.ids) } }, include: STORE_PRODUCT_INCLUDE });
  const byId = new Map(rows.map((sp) => [sp.id, sp]));
  const products = ranked.flatMap((r) => r.ids.flatMap((id) => (byId.has(id) ? [enrichStoreProduct(byId.get(id))] : [])));
  return { products, total: ranked[0]?.total ?? 0 };
}

export async function bandPage(prisma: PrismaClient, f: BandFilter, page: number): Promise<PriceBandPage> {
  const [chips, list] = await Promise.all([bandChips(prisma, { ...f, categoryId: undefined }), bandProducts(prisma, f, page)]);
  return { chips, ...list };
}
