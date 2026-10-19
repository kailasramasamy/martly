import type { PrismaClient } from "../../../generated/prisma/client.js";
import { STORE_PRODUCT_INCLUDE, withAllSizes } from "../store-feed.js";

const BUY_AGAIN_MIN = 6;
const FEED_ROW_LIMIT = 10;

/** Store listings with a discount running right now. */
export function activeDealRows(prisma: PrismaClient, storeId: string, now: Date) {
  return prisma.storeProduct.findMany({
    where: {
      storeId,
      isActive: true,
      discountType: { not: null },
      discountValue: { gt: 0 },
      OR: [
        { discountStart: null, discountEnd: null },
        { discountStart: { lte: now }, discountEnd: null },
        { discountStart: null, discountEnd: { gte: now } },
        { discountStart: { lte: now }, discountEnd: { gte: now } },
      ],
    },
    take: FEED_ROW_LIMIT,
    include: STORE_PRODUCT_INCLUDE,
  });
}

/** The shopper's past orders at this store, one line per product, newest first. */
export function pastOrderLines(prisma: PrismaClient, storeId: string, userId: string) {
  return prisma.orderItem.findMany({
    where: { order: { userId, storeId, status: { in: ["DELIVERED", "CONFIRMED"] } } },
    distinct: ["productId"],
    orderBy: { order: { createdAt: "desc" } },
    take: FEED_ROW_LIMIT,
    include: { storeProduct: { include: STORE_PRODUCT_INCLUDE } },
  });
}

// Related products from the same aisles, then popular ones from anywhere, to fill the row
async function supplementRows(prisma: PrismaClient, storeId: string, rows: any[]) {
  const existingProductIds = rows.map((b) => b.productId as string);
  const subcategoryIds = [...new Set(rows.map((b) => b.product?.subcategory?.id).filter(Boolean))] as string[];

  let supplementRaw: any[] = [];
  if (subcategoryIds.length > 0) {
    supplementRaw = await prisma.storeProduct.findMany({
      where: {
        storeId,
        isActive: true,
        product: { subcategoryId: { in: subcategoryIds }, id: { notIn: existingProductIds }, isActive: true },
      },
      take: BUY_AGAIN_MIN - rows.length,
      orderBy: { stock: "desc" },
      include: STORE_PRODUCT_INCLUDE,
    });
  }

  const stillNeeded = BUY_AGAIN_MIN - rows.length - supplementRaw.length;
  if (stillNeeded <= 0) return supplementRaw;
  const excludeProductIds = [...existingProductIds, ...supplementRaw.map((sp) => sp.productId as string)];
  const popularRaw = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, stock: { gt: 0 }, product: { id: { notIn: excludeProductIds }, isActive: true } },
    take: stillNeeded,
    orderBy: [{ isFeatured: "desc" }, { stock: "desc" }],
    include: STORE_PRODUCT_INCLUDE,
  });
  return [...supplementRaw, ...popularRaw];
}

/** Previously ordered products, topped up with related ones below the minimum, every size included. */
export async function buyAgainProducts(prisma: PrismaClient, storeId: string, orderLines: Awaited<ReturnType<typeof pastOrderLines>>) {
  const rows: any[] = orderLines.filter((item) => item.storeProduct?.product).map((item) => item.storeProduct);
  if (rows.length > 0 && rows.length < BUY_AGAIN_MIN) rows.push(...(await supplementRows(prisma, storeId, rows)));
  return withAllSizes(prisma, storeId, rows);
}
