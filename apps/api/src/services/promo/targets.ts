import { DISCOUNTABLE_TARGETS } from "@martly/shared/constants";
import type { BannerActionType, Prisma, PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The products a manual promotion covers: whatever its banners open (an aisle at any level, a product, a
 * collection or a brand), limited to products the organisation's active stores list.
 */
export async function productsForTarget(db: Db, organizationId: string, actionType: BannerActionType | null, actionTarget: string | null) {
  if (!actionType || !actionTarget || !(DISCOUNTABLE_TARGETS as readonly string[]).includes(actionType)) return [];
  const listed: Prisma.ProductWhereInput = { storeProducts: { some: { isActive: true, store: { organizationId, status: "ACTIVE" } } } };
  const scope: Prisma.ProductWhereInput =
    actionType === "PRODUCT" ? { id: actionTarget }
    : actionType === "BRAND" ? { brandId: actionTarget }
    : actionType === "COLLECTION" ? { collectionItems: { some: { collectionId: actionTarget } } }
    : { OR: [{ subcategoryId: actionTarget }, { subcategory: { categoryId: actionTarget } }, { subcategory: { category: { departmentId: actionTarget } } }] };
  const products = await db.product.findMany({ where: { AND: [listed, scope] }, select: { id: true } });
  return products.map((p) => p.id);
}
