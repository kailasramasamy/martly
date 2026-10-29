import type { PrismaClient } from "../../generated/prisma/client.js";
import { refundListing } from "./marketing/listing-credits.js";

export class ProductInUseError extends Error {
  name = "ProductInUseError";
  statusCode = 409;
}

/** Orders, reviews and subscriptions keep pointing at a product, so one that has any can only be turned off */
async function inUse(prisma: PrismaClient, productId: string) {
  const [orders, reviews, subscriptions, addOns] = await Promise.all([
    prisma.orderItem.count({ where: { productId } }),
    prisma.review.count({ where: { productId } }),
    prisma.subscriptionItem.count({ where: { storeProduct: { productId } } }),
    prisma.basketAddOn.count({ where: { storeProduct: { productId } } }),
  ]);
  return orders + reviews + subscriptions + addOns > 0;
}

/** Deletes a product with its store listings (their stock history goes with them) and gives back the listing it used */
export async function deleteProduct(prisma: PrismaClient, productId: string) {
  if (await inUse(prisma, productId)) {
    throw new ProductInUseError("This product has orders, reviews or subscriptions, so it can't be deleted. Turn it off instead.");
  }
  await prisma.$transaction(async (tx) => {
    await refundListing(tx, productId);
    await tx.storeProduct.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
  });
}
