import { STOREFRONT_MIN } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { fromCount, type CheckContext } from "./context.js";

const DAY_MS = 86_400_000;
const STALE_EARNED = 0.4;

/** A live "From the shop" post, owner picks and recently added products */
export async function freshChecks({ prisma, store, now }: CheckContext) {
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const [latestPost, picks, added] = await Promise.all([
    prisma.storePost.findFirst({ where: { storeId: store.id }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true } }),
    prisma.storePick.count({ where: { storeId: store.id } }),
    prisma.storeProduct.count({ where: { storeId: store.id, isActive: true, createdAt: { gte: since(STOREFRONT_MIN.NEW_PRODUCT_DAYS) } } }),
  ]);
  let post: StorefrontCheckResult = { key: "POST", status: "OFF", earned: 0 };
  if (latestPost && latestPost.expiresAt > now) post = { key: "POST", status: "ON", earned: 1 };
  else if (latestPost && latestPost.expiresAt > since(STOREFRONT_MIN.POST_STALE_DAYS)) post = { key: "POST", status: "STALE", earned: STALE_EARNED };
  return [post, fromCount("PICKS", picks, STOREFRONT_MIN.PICKS), fromCount("NEW_PRODUCTS", added, STOREFRONT_MIN.NEW_PRODUCTS)];
}
