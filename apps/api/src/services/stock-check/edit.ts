import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { variantName } from "@martly/shared/constants";
import type { StockCheckEditInput } from "@martly/shared/schemas";
import type { StockCheckEditResult } from "@martly/shared/types";
import { recordOpeningStock } from "../stock-ledger.js";

type Tx = Prisma.TransactionClient;
type NewSize = StockCheckEditInput["newSizes"][number];

const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

/** Confirmed by the owner as carried at a price they set, so both checks are done */
const confirmed = (price: number, outcome: "KEPT" | "CHANGED", userId: string, at: Date) => ({
  price, carried: true, isActive: true, carryCheckedAt: at, carryCheckedById: userId,
  priceReviewOutcome: outcome, priceReviewedAt: at, priceReviewedById: userId,
});

async function loadListings(prisma: PrismaClient, store: { id: string; organizationId: string }, input: StockCheckEditInput) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, OR: [{ organizationId: null }, { organizationId: store.organizationId }] },
    select: { name: true },
  });
  if (!product) throw badRequest("Product not found");
  const listings = await prisma.storeProduct.findMany({
    where: { storeId: store.id, productId: input.productId },
    select: { id: true, price: true, mrp: true, stock: true, variantId: true, variant: { select: { name: true, mrp: true } } },
  });
  const byId = new Map(listings.map((l) => [l.id, l]));
  if (input.sizes.some((s) => !byId.has(s.id))) throw badRequest(`Some sizes aren't ${product.name} at this store`);
  return { product, listings, byId };
}

/** The catalog size for this unit, made once and shared: the price stays on each store's own listing */
async function sizeVariant(tx: Tx, productId: string, size: NewSize) {
  const existing = await tx.productVariant.findFirst({ where: { productId, unitType: size.unitType, unitValue: size.unitValue }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.productVariant.create({
    data: { productId, name: variantName(size.unitType, size.unitValue), unitType: size.unitType, unitValue: size.unitValue },
    select: { id: true },
  });
  return created.id;
}

/** Fix a product's prices and add the sizes the store sells, from the stock-check sizes screen */
export async function editProduct(
  prisma: PrismaClient, store: { id: string; organizationId: string }, input: StockCheckEditInput, userId: string,
): Promise<StockCheckEditResult> {
  const { product, listings, byId } = await loadListings(prisma, store, input);
  for (const s of input.sizes) {
    const sp = byId.get(s.id)!;
    const mrp = sp.mrp ?? sp.variant.mrp;
    if (mrp !== null && s.price > Number(mrp)) throw badRequest(`${product.name} ${sp.variant.name}: ₹${s.price} is above the MRP ₹${Number(mrp)}`);
  }
  // A new size starts with the stock its sibling sizes were given, so it can be ordered straight away
  const stock = Math.max(0, ...listings.map((l) => l.stock));
  const at = new Date();
  return prisma.$transaction(async (tx) => {
    const ids = [];
    for (const s of input.sizes) {
      const outcome = Number(byId.get(s.id)!.price) === s.price ? "KEPT" : "CHANGED";
      ids.push((await tx.storeProduct.update({ where: { id: s.id }, data: confirmed(s.price, outcome, userId, at), select: { id: true } })).id);
    }
    for (const size of input.newSizes) {
      const variantId = await sizeVariant(tx, input.productId, size);
      const listed = listings.find((l) => l.variantId === variantId);
      if (listed) {
        ids.push((await tx.storeProduct.update({ where: { id: listed.id }, data: confirmed(size.price, "CHANGED", userId, at), select: { id: true } })).id);
        continue;
      }
      const row = await tx.storeProduct.create({
        data: { storeId: store.id, productId: input.productId, variantId, stock, ...confirmed(size.price, "CHANGED", userId, at) },
        select: { id: true, storeId: true, stock: true },
      });
      await recordOpeningStock(tx, [row], userId);
      ids.push(row.id);
    }
    return { storeProductIds: ids };
  });
}
