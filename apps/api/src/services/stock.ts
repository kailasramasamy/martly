import type { PrismaClient } from "../../generated/prisma/client.js";

interface StockItem {
  storeProductId: string;
  quantity: number;
}

/**
 * Atomically reserve stock for order items.
 * Uses raw SQL with a WHERE guard to prevent overselling.
 * Throws if any item has insufficient available stock.
 */
export async function reserveStock(prisma: PrismaClient, items: StockItem[]) {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const result = await tx.$executeRaw`
        UPDATE store_products
        SET reserved_stock = reserved_stock + ${item.quantity}
        WHERE id = ${item.storeProductId}
          AND stock - reserved_stock >= ${item.quantity}
      `;
      if (result === 0) {
        // Fetch product name for a helpful error message
        const sp = await tx.storeProduct.findUnique({
          where: { id: item.storeProductId },
          include: { product: true },
        });
        const name = sp?.product?.name ?? item.storeProductId;
        const available = sp ? sp.stock - sp.reservedStock : 0;
        throw Object.assign(
          new Error(`Insufficient stock for "${name}" (available: ${available}, requested: ${item.quantity})`),
          { statusCode: 409 },
        );
      }
    }
  });
}

/**
 * Release reserved stock (e.g. on order cancellation).
 */
export async function releaseStock(prisma: PrismaClient, items: StockItem[]) {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE store_products
        SET reserved_stock = GREATEST(reserved_stock - ${item.quantity}, 0)
        WHERE id = ${item.storeProductId}
      `;
    }
  });
}

/**
 * Deduct stock on order delivery — decrements both stock and reservedStock.
 */
export async function deductStock(prisma: PrismaClient, items: StockItem[]) {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE store_products
        SET stock = GREATEST(stock - ${item.quantity}, 0),
            reserved_stock = GREATEST(reserved_stock - ${item.quantity}, 0)
        WHERE id = ${item.storeProductId}
      `;
    }
  });
}
