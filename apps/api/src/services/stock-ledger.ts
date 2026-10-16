import type { Prisma } from "../../generated/prisma/client.js";
import type { StockMovementType } from "@martly/shared/constants";

type Tx = Prisma.TransactionClient;

export interface MovementInput {
  storeProductId: string;
  /** Signed change; stock never goes below zero, so the recorded change may be smaller */
  quantity: number;
  type: StockMovementType;
  note?: string | null;
  userId?: string | null;
  stockCountId?: string;
  orderId?: string;
}

/**
 * The one way to change on-hand stock: locks the row, applies the change and records who, why and before/after.
 * Run inside a transaction so the lock holds until commit.
 */
export async function applyMovement(tx: Tx, m: MovementInput) {
  const [row] = await tx.$queryRaw<{ stock: number; store_id: string; organization_id: string }[]>`
    SELECT sp.stock, sp.store_id, s.organization_id
    FROM store_products sp JOIN stores s ON s.id = sp.store_id
    WHERE sp.id = ${m.storeProductId}
    FOR UPDATE OF sp`;
  if (!row) throw Object.assign(new Error("Store product not found"), { statusCode: 404 });

  const stockAfter = Math.max(0, row.stock + m.quantity);
  await tx.storeProduct.update({ where: { id: m.storeProductId }, data: { stock: stockAfter } });
  return tx.stockMovement.create({
    data: {
      organizationId: row.organization_id,
      storeId: row.store_id,
      storeProductId: m.storeProductId,
      type: m.type,
      quantity: stockAfter - row.stock,
      stockBefore: row.stock,
      stockAfter,
      note: m.note ?? null,
      userId: m.userId ?? null,
      stockCountId: m.stockCountId,
      orderId: m.orderId,
    },
  });
}

/** Opening stock for newly listed store products, recorded as a receipt */
export async function recordOpeningStock(
  tx: Tx,
  rows: { id: string; storeId: string; stock: number }[],
  userId?: string | null,
) {
  const stocked = rows.filter((r) => r.stock > 0);
  if (stocked.length === 0) return;
  const stores = await tx.store.findMany({
    where: { id: { in: [...new Set(stocked.map((r) => r.storeId))] } },
    select: { id: true, organizationId: true },
  });
  const orgOf = new Map(stores.map((s) => [s.id, s.organizationId]));
  await tx.stockMovement.createMany({
    data: stocked.map((r) => ({
      organizationId: orgOf.get(r.storeId)!,
      storeId: r.storeId,
      storeProductId: r.id,
      type: "RECEIVE" as const,
      quantity: r.stock,
      stockBefore: 0,
      stockAfter: r.stock,
      note: "Opening stock",
      userId: userId ?? null,
    })),
  });
}
