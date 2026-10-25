import type { MonthlyListItemOptions } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { sizeOf } from "../pack-deals.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../store-product-view.js";

const BRAND_CANDIDATES = 60;
const BRAND_LIMIT = 12;
// Sizes in another base unit (kg against pieces) sort after every comparable one
const NOT_COMPARABLE = 10;

type Sized = { variant: { unitType: string; unitValue: unknown }; price: unknown };

/** Orders listings closest in size to `target` first, then closest in price */
export function closestTo(target: { unitType: string; unitValue: unknown }, price: number | null) {
  const own = sizeOf(target);
  const gap = (sp: Sized) => {
    const size = sizeOf(sp.variant);
    return own && size && size.base === own.base ? Math.abs(Math.log(size.amount / own.amount)) : NOT_COMPARABLE;
  };
  const priceGap = (sp: Sized) => (price == null ? 0 : Math.abs(Number(sp.price) - price));
  return (a: Sized, b: Sized) => gap(a) - gap(b) || priceGap(a) - priceGap(b);
}

const amountOf = (sp: Sized) => sizeOf(sp.variant)?.amount ?? 0;

/** A list line's swaps at the list's store; null when the line isn't on one of the shopper's lists */
export async function itemOptions(prisma: PrismaClient, userId: string, listId: string, itemId: string) {
  const item = await prisma.monthlyListItem.findFirst({
    where: { id: itemId, list: { id: listId, userId } },
    include: {
      list: { select: { storeId: true, items: { select: { productId: true } } } },
      product: { select: { subcategoryId: true } },
      variant: { select: { unitType: true, unitValue: true } },
    },
  });
  if (!item) return null;
  const { storeId } = item.list;
  const inStock = { storeId, isActive: true, stock: { gt: 0 } };
  const onList = item.list.items.map((i) => i.productId);
  const [sizes, brands] = await Promise.all([
    prisma.storeProduct.findMany({
      where: { ...inStock, productId: item.productId, variantId: { not: item.variantId }, product: { isActive: true } },
      include: storeProductInclude,
    }),
    item.product.subcategoryId
      ? prisma.storeProduct.findMany({
        where: { ...inStock, productId: { notIn: onList }, product: { isActive: true, subcategoryId: item.product.subcategoryId } },
        include: storeProductInclude,
        take: BRAND_CANDIDATES,
      })
      : [],
  ]);
  const own = await prisma.storeProduct.findFirst({ where: { storeId, variantId: item.variantId }, select: { price: true } });
  const available = <T extends { stock: number; reservedStock: number }>(rows: T[]) => rows.filter((sp) => sp.stock > sp.reservedStock);
  const picked = available(brands).sort(closestTo(item.variant, own ? Number(own.price) : null)).slice(0, BRAND_LIMIT);
  const [sizeViews, brandViews] = await Promise.all([
    decorateStoreProducts(prisma, available(sizes).sort((a, b) => amountOf(a) - amountOf(b))),
    decorateStoreProducts(prisma, picked),
  ]);
  return { sizes: sizeViews, brands: brandViews } satisfies MonthlyListItemOptions<StoreProductView>;
}
