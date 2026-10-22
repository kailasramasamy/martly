import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CartReviewInput } from "@martly/shared/schemas";
import { predictReorders } from "./reorder.js";
import { decorateStoreProducts, storeProductInclude } from "./store-product-view.js";

const SUGGESTION_LIMIT = 8;
// A gap filler costs the gap up to half as much again (at least ₹40 over), so one item closes it without overshooting much
const GAP_STRETCH = 1.5;
const GAP_MIN_SPREAD = 40;
const GAP_CANDIDATES = 60;
// So the gap rail isn't eight detergents
const GAP_PER_SUBCATEGORY = 2;

const sellable = { isActive: true, product: { isActive: true } } as const;

// One size per product, in the order given
function firstPerProduct<T extends { productId: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.productId) && seen.add(r.productId));
}

// The customer's usual items that are due or overdue and not in the cart, in the size they buy
async function forgottenItems(prisma: PrismaClient, userId: string, storeId: string, cartProductIds: string[]) {
  const due = (await predictReorders(prisma, userId, storeId))
    .filter((p) => p.status !== "not_yet" && !cartProductIds.includes(p.productId));
  const order = due.map((p) => p.storeProductId);
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: order }, storeId, ...sellable }, include: storeProductInclude });
  const inStock = rows.filter((sp) => sp.stock - sp.reservedStock > 0).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return decorateStoreProducts(prisma, firstPerProduct(inStock).slice(0, SUGGESTION_LIMIT));
}

// In-stock items priced just over the gap: from the categories the shopper is buying first, then the store's best sellers and popular brands
async function gapFillers(prisma: PrismaClient, storeId: string, gap: number, excludeProductIds: string[], categoryIds: string[]) {
  const ceiling = Math.max(gap * GAP_STRETCH, gap + GAP_MIN_SPREAD);
  const candidates = await prisma.$queryRaw<{ id: string }[]>`
    SELECT sp.id FROM store_products sp
    JOIN products p ON p.id = sp.product_id AND p.is_active AND p.image_url IS NOT NULL
    LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '90 days'
      GROUP BY oi.product_id
    ) s ON s.product_id = sp.product_id
    WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
      AND sp.price >= ${gap} AND (sp.price <= ${ceiling} OR (sp.discount_type IS NOT NULL AND sp.price <= ${ceiling * 2}))
      AND sp.product_id <> ALL(${excludeProductIds}::text[])
    ORDER BY COALESCE(sc.category_id = ANY(${categoryIds}::text[]), false) DESC, COALESCE(s.units, 0) DESC, COALESCE(b.popularity, 0) DESC
    LIMIT ${GAP_CANDIDATES}`;
  const order = candidates.map((c) => c.id);
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: order } }, include: storeProductInclude });
  rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const priced = (await decorateStoreProducts(prisma, rows))
    .filter((sp) => sp.pricing.effectivePrice >= gap && sp.pricing.effectivePrice <= ceiling);
  const perSubcategory = new Map<string | null, number>();
  return firstPerProduct(priced)
    .filter((sp) => {
      const n = perSubcategory.get(sp.product.subcategoryId) ?? 0;
      perSubcategory.set(sp.product.subcategoryId, n + 1);
      return n < GAP_PER_SUBCATEGORY;
    })
    .slice(0, SUGGESTION_LIMIT);
}

/**
 * The cart's lines as the store sells them now (a line missing from `lines` can no longer be bought),
 * the customer's due items they haven't added, and items that close the gap to the minimum or free delivery.
 */
export async function reviewCart(prisma: PrismaClient, userId: string | null, input: CartReviewInput) {
  const { storeId, storeProductIds, gap } = input;
  const rows = await prisma.storeProduct.findMany({ where: { storeId, id: { in: storeProductIds }, ...sellable }, include: storeProductInclude });
  const lines = await decorateStoreProducts(prisma, rows);
  const cartProductIds = [...new Set(lines.map((l) => l.productId))];
  const forgotten = userId ? await forgottenItems(prisma, userId, storeId, cartProductIds) : [];
  const categoryIds = [...new Set(lines.flatMap((sp) => sp.product.subcategory?.categoryId ?? []))];
  const shownProductIds = [...cartProductIds, ...forgotten.map((f) => f.productId)];
  const fillers = gap ? await gapFillers(prisma, storeId, gap, shownProductIds, categoryIds) : [];
  return { lines, forgotten, gapFillers: fillers };
}
