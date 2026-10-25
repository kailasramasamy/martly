import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CartReviewInput } from "@martly/shared/schemas";
import type { CouponOffer } from "@martly/shared/types";
import { dueInStock } from "./reorder.js";
import { decorateStoreProducts, storeProductInclude } from "./store-product-view.js";
import { couponOffers } from "./coupon-offers.js";
import { packDeals } from "./pack-deals.js";

const SUGGESTION_LIMIT = 8;
// A gap filler costs the gap up to half as much again (at least ₹40 over), so one item closes it without overshooting much
const GAP_STRETCH = 1.5;
const GAP_MIN_SPREAD = 40;
const GAP_CANDIDATES = 60;
// So the gap rail isn't eight detergents
const GAP_PER_SUBCATEGORY = 2;

// A locked coupon is worth mentioning only when it's in reach: at most ₹150 more, or doubling the cart
const COUPON_MIN_REACH = 150;

const sellable = { isActive: true, product: { isActive: true } } as const;

// One size per product, in the order given
function firstPerProduct<T extends { productId: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.productId) && seen.add(r.productId));
}

// The customer's usual items that are due or overdue and not in the cart, in the size they buy
async function forgottenItems(prisma: PrismaClient, userId: string, storeId: string, cartProductIds: string[]) {
  const due = (await dueInStock(prisma, userId, storeId)).filter((sp) => !cartProductIds.includes(sp.productId));
  return decorateStoreProducts(prisma, due.slice(0, SUGGESTION_LIMIT));
}

// In-stock items priced just over the gap: from the departments the shopper is buying in first, but never the cart's own
// categories (a salt cart gets dal or spices, not more salt), then the store's best sellers and popular brands
async function gapFillers(prisma: PrismaClient, storeId: string, gap: number, excludeProductIds: string[], cartCategoryIds: string[]) {
  const ceiling = Math.max(gap * GAP_STRETCH, gap + GAP_MIN_SPREAD);
  const candidates = await prisma.$queryRaw<{ id: string }[]>`
    SELECT sp.id FROM store_products sp
    JOIN products p ON p.id = sp.product_id AND p.is_active AND p.image_url IS NOT NULL
    LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
    LEFT JOIN categories c ON c.id = sc.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '90 days'
      GROUP BY oi.product_id
    ) s ON s.product_id = sp.product_id
    WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
      AND sp.price >= ${gap} AND (sp.price <= ${ceiling} OR (sp.discount_type IS NOT NULL AND sp.price <= ${ceiling * 2}))
      AND sp.product_id <> ALL(${excludeProductIds}::text[])
      AND (sc.category_id IS NULL OR sc.category_id <> ALL(${cartCategoryIds}::text[]))
    ORDER BY COALESCE(c.department_id IN (SELECT department_id FROM categories WHERE id = ANY(${cartCategoryIds}::text[])), false) DESC, COALESCE(s.units, 0) DESC, COALESCE(b.popularity, 0) DESC
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

// The coupon to mention: the one already applied, else the best one that applies now, else the nearest one to unlock
async function couponHint(prisma: PrismaClient, organizationId: string, userId: string | null, itemTotal: number, applied?: string): Promise<CouponOffer | null> {
  const offers = await couponOffers(prisma, { organizationId, userId: userId ?? "", orderAmount: itemTotal });
  const chosen = offers.find((o) => o.code === applied);
  if (chosen) return chosen;
  const reach = Math.max(COUPON_MIN_REACH, itemTotal);
  const locked = offers.filter((o) => o.shortBy != null && o.shortBy <= reach).sort((a, b) => a.shortBy! - b.shortBy!);
  return offers.find((o) => o.eligible) ?? locked[0] ?? null;
}

// Whether the shopper has an active membership here, and if not, the cheapest plan that brings free delivery
async function membership(prisma: PrismaClient, organizationId: string, userId: string | null) {
  const [active, plan] = await Promise.all([
    userId ? prisma.userMembership.findFirst({ where: { userId, organizationId, status: "ACTIVE", endDate: { gt: new Date() } }, select: { id: true } }) : null,
    prisma.membershipPlan.findFirst({
      where: { organizationId, isActive: true, freeDelivery: true },
      orderBy: { price: "asc" },
      select: { name: true, price: true, duration: true },
    }),
  ]);
  const plusOffer = active || !plan ? null : { name: plan.name, price: Number(plan.price), duration: plan.duration };
  return { isMember: active != null, plusOffer };
}

/**
 * The cart's lines as the store sells them now (a line missing from `lines` can no longer be bought), the customer's
 * due items they haven't added, items that close the gap to the minimum or free delivery, bigger packs that save,
 * the coupon worth mentioning, and the membership plan that would make delivery free.
 */
export async function reviewCart(prisma: PrismaClient, userId: string | null, store: { id: string; organizationId: string }, input: CartReviewInput) {
  const { gap, itemTotal } = input;
  const quantities = new Map(input.lines.map((l) => [l.storeProductId, l.quantity]));
  const rows = await prisma.storeProduct.findMany({ where: { storeId: store.id, id: { in: [...quantities.keys()] }, ...sellable }, include: storeProductInclude });
  const [lines, member] = await Promise.all([decorateStoreProducts(prisma, rows), membership(prisma, store.organizationId, userId)]);
  const cartProductIds = [...new Set(lines.map((l) => l.productId))];
  const forgotten = userId ? await forgottenItems(prisma, userId, store.id, cartProductIds) : [];
  const categoryIds = [...new Set(lines.flatMap((sp) => sp.product.subcategory?.categoryId ?? []))];
  const shownProductIds = [...cartProductIds, ...forgotten.map((f) => f.productId)];
  const [fillers, deals, coupon] = await Promise.all([
    gap ? gapFillers(prisma, store.id, gap, shownProductIds, categoryIds) : [],
    packDeals(prisma, store.id, lines, quantities, member.isMember),
    itemTotal ? couponHint(prisma, store.organizationId, userId, itemTotal, input.couponCode) : null,
  ]);
  return { lines, forgotten, gapFillers: fillers, packDeals: deals, coupon, plusOffer: member.plusOffer };
}
