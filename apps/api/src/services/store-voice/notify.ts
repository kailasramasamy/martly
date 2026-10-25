import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient, StorePostKind } from "../../../generated/prisma/client.js";
import { istNow } from "../ist-day.js";
import { sendCampaignNotifications } from "../notification.js";
import { claimOnce } from "../notify/once.js";

const AUDIENCE_DAYS = 60;
// An aisle's buyers fewer than this: the post goes to every recent shopper, so a small store never tells nobody
const MIN_AISLE_AUDIENCE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
// The push carries the post's opening; the board shows the rest
const BODY_CHARS = 140;

// Shoppers who ordered at the store lately; with aisles, only those who bought from them
async function recentShoppers(prisma: PrismaClient, storeId: string, categoryIds: string[]) {
  const orders = await prisma.order.findMany({
    where: {
      storeId, status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - AUDIENCE_DAYS * DAY_MS) },
      ...(categoryIds.length ? { items: { some: { product: { subcategory: { categoryId: { in: categoryIds } } } } } } : {}),
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return orders.map((o) => o.userId);
}

/** Why the push reaches whom: the aisles' buyers, or everyone because it's new, untagged, or the aisles have too few */
export type AudienceScope = "AISLES" | "NEW" | "UNTAGGED" | "FEW_BUYERS";

/**
 * Who a post's push reaches. Restock news (fresh today, back in stock) goes to the buyers of its products' aisles;
 * "new in store" is for discovery, so it goes to every shopper of the last 60 days, as does restock news whose aisles
 * have too few buyers or that tags no products
 */
export async function postAudience(prisma: PrismaClient, storeId: string, kind: StorePostKind, productIds: string[]) {
  const everyone = async (scope: AudienceScope, aisleBuyers?: number) =>
    ({ userIds: await recentShoppers(prisma, storeId, []), scope, aisleBuyers });
  if (kind === "NEW_IN_STORE") return everyone("NEW");
  const aisles = productIds.length === 0 ? [] : await prisma.subcategory.findMany({
    where: { products: { some: { id: { in: productIds } } } }, select: { categoryId: true },
  });
  const categoryIds = [...new Set(aisles.map((a) => a.categoryId))];
  if (categoryIds.length === 0) return everyone("UNTAGGED");
  const buyers = await recentShoppers(prisma, storeId, categoryIds);
  if (buyers.length >= MIN_AISLE_AUDIENCE) return { userIds: buyers, scope: "AISLES" as AudienceScope, aisleBuyers: buyers.length };
  return everyone("FEW_BUYERS", buyers.length);
}

/**
 * Tells shoppers about a post: one post push per store a day, so a busy owner can't flood phones. False when today's
 * push was already sent (the post still shows on Home and the board).
 */
export async function notifyStorePost(fcm: Messaging | null, prisma: PrismaClient, postId: string, sentBy: string) {
  const post = await prisma.storePost.findUnique({
    where: { id: postId },
    select: { storeId: true, kind: true, text: true, products: { select: { productId: true } }, store: { select: { name: true, organizationId: true } } },
  });
  if (!post) return false;
  const won = await claimOnce(prisma, [`store-post-push:${post.storeId}:${istNow().key}`]);
  if (won.size === 0) return false;
  const { userIds } = await postAudience(prisma, post.storeId, post.kind, post.products.map((p) => p.productId));
  const body = post.text.length > BODY_CHARS ? `${post.text.slice(0, BODY_CHARS - 1)}…` : post.text;
  const data = { screen: "store-posts", storeId: post.storeId };
  const campaign = await prisma.notificationCampaign.create({
    data: {
      organizationId: post.store.organizationId, title: post.store.name, body, type: "STORE_NOTICE", data,
      audienceType: "STORE_CUSTOMERS", audienceConfig: { storeId: post.storeId }, status: "SENT",
      recipientCount: userIds.length, sentAt: new Date(), sentBy,
    },
  });
  await sendCampaignNotifications(fcm, prisma, campaign.id, userIds, { type: "STORE_NOTICE", title: post.store.name, body, data });
  await prisma.storePost.update({ where: { id: postId }, data: { notifiedAt: new Date() } });
  return true;
}
