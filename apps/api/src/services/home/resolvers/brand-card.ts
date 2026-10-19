import { HOME_BRAND_CARD_PRODUCTS } from "@martly/shared/constants";
import { parseHomeSectionConfig } from "@martly/shared/schemas";
import { withAllSizes } from "../../store-feed.js";
import { sectionBase, type SectionResolver } from "../types.js";
import { liveCollection } from "./collection.js";

type BrandConfig = { brandId: string; tint?: string; imageUrl?: string };

// Look back this far for what the store's shoppers buy most; products nobody bought yet rotate daily
const SALES_WINDOW_DAYS = 90;

export const brandCard: SectionResolver = async (ctx, entry) => {
  const config = parseHomeSectionConfig("BRAND_CARD", entry.config) as BrandConfig;
  const [brand, collection] = await Promise.all([
    ctx.prisma.brand.findFirst({
      where: { id: config.brandId, OR: [{ organizationId: null }, { organizationId: ctx.store.organizationId }] },
      select: { id: true, name: true, imageUrl: true, themeColor: true },
    }),
    entry.collectionId ? liveCollection(ctx, entry.collectionId) : null,
  ]);
  if (!brand || (entry.collectionId && !collection)) return null;
  const since = new Date(ctx.now.getTime() - SALES_WINDOW_DAYS * 86_400_000);
  const ranked = await ctx.prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
      AND oi.order_id IN (SELECT o.id FROM orders o WHERE o.store_id = ${ctx.store.id} AND o.created_at >= ${since})
    WHERE p.brand_id = ${brand.id} AND p.is_active
      AND EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0)
      AND (${!collection} OR EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = ${collection?.id ?? ""} AND ci.product_id = p.id))
    GROUP BY p.id ORDER BY COUNT(oi.id) DESC, md5(p.id || ${ctx.now.toISOString().slice(0, 10)})
    LIMIT ${HOME_BRAND_CARD_PRODUCTS}`;
  if (ranked.length < HOME_BRAND_CARD_PRODUCTS) return null;
  return {
    ...sectionBase(entry),
    title: entry.title ?? brand.name,
    type: "BRAND_CARD",
    brand: { id: brand.id, name: brand.name, logoUrl: brand.imageUrl, themeColor: brand.themeColor },
    imageUrl: config.imageUrl ?? null,
    tint: config.tint ?? brand.themeColor ?? null,
    products: await withAllSizes(ctx.prisma, ctx.store.id, ranked.map((r) => ({ productId: r.id }))),
    seeAll: collection ? { collectionId: collection.id } : { href: `/brand/${brand.id}` },
  };
};
