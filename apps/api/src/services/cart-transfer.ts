import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CartTransferInput } from "@martly/shared/schemas";
import { decorateStoreProducts, storeProductInclude } from "./store-product-view.js";

const sellable = { isActive: true, product: { isActive: true } } as const;

/**
 * The cart's products at another store: each size it sells and has in stock comes back at that store's price,
 * and the rest come back as missing so the shopper sees what didn't make the move
 */
export async function transferCart(prisma: PrismaClient, input: CartTransferInput) {
  const rows = await prisma.storeProduct.findMany({
    where: { storeId: input.toStoreId, variantId: { in: input.lines.map((l) => l.variantId) }, ...sellable },
    include: storeProductInclude,
  });
  const listings = await decorateStoreProducts(prisma, rows);
  const byVariant = new Map(listings.filter((sp) => sp.availableStock > 0).map((sp) => [sp.variantId, sp]));
  const moved = input.lines.flatMap((l) => {
    const sp = byVariant.get(l.variantId);
    return sp ? [{ ...sp, quantity: Math.min(l.quantity, sp.availableStock) }] : [];
  });
  const missing = input.lines.filter((l) => !byVariant.has(l.variantId));
  return { moved, missing };
}
