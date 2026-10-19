import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { calculateEffectivePrice } from "../pricing.js";
import { istNow } from "../ist-day.js";
import { alertOnce, promotionalAllowed } from "./once.js";
import { plural } from "./copy.js";
import { sendNotification } from "../notification.js";

const PRICE_DROP_RATIO = 0.95;

interface Snapshot { price: number; inStock: boolean }

/** Cheapest active listing of a product at a store, and whether any of its listings has stock; null when not sold there */
export async function wishlistSnapshot(prisma: PrismaClient, productId: string, storeId: string): Promise<Snapshot | null> {
  const listings = await prisma.storeProduct.findMany({
    where: { productId, storeId, isActive: true },
    include: { variant: true },
  });
  if (listings.length === 0) return null;
  const prices = listings.map((sp) => calculateEffectivePrice(
    sp.price,
    { discountType: sp.variant.discountType, discountValue: sp.variant.discountValue, discountStart: sp.variant.discountStart, discountEnd: sp.variant.discountEnd },
    { discountType: sp.discountType, discountValue: sp.discountValue, discountStart: sp.discountStart, discountEnd: sp.discountEnd },
    sp.memberPrice,
  ).effectivePrice);
  return { price: Math.min(...prices), inStock: listings.some((sp) => sp.stock - sp.reservedStock > 0) };
}

interface Change { productId: string; name: string; kind: "restock" | "drop" }

function copyFor(changes: Change[]) {
  const [first] = changes;
  if (changes.length === 1) {
    return first.kind === "restock"
      ? { title: `Back in stock: ${first.name}`, body: "It's available again. Grab it before it sells out." }
      : { title: `Price drop on ${first.name}`, body: "It's now cheaper than when you saved it." };
  }
  const kinds = new Set(changes.map((c) => c.kind));
  const title = kinds.size > 1
    ? `${plural(changes.length, "wishlist update")}`
    : kinds.has("restock") ? `${plural(changes.length, "wishlist item")} back in stock` : `Price drop on ${plural(changes.length, "wishlist item")}`;
  return { title, body: `${first.name} and ${changes.length - 1} more.` };
}

/** Once a day: compares each wishlist item with its snapshot, notifies once per user, then refreshes the snapshots */
export async function runWishlistAlerts(fcm: Messaging | null, prisma: PrismaClient) {
  if (!(await alertOnce(prisma, `wishlist-run:${istNow().key}`))) return;
  const items = await prisma.wishlistItem.findMany({
    where: { storeId: { not: null }, store: { status: "ACTIVE" } },
    include: { product: { select: { name: true } } },
  });
  const changesByUser = new Map<string, Change[]>();
  for (const item of items) {
    const now = await wishlistSnapshot(prisma, item.productId, item.storeId as string);
    if (!now) continue;
    const restock = item.wasInStock === false && now.inStock;
    const drop = item.lastPrice !== null && now.price <= Number(item.lastPrice) * PRICE_DROP_RATIO && now.inStock;
    if (restock || drop) {
      const list = changesByUser.get(item.userId) ?? [];
      list.push({ productId: item.productId, name: item.product.name, kind: restock ? "restock" : "drop" });
      changesByUser.set(item.userId, list);
    }
    await prisma.wishlistItem.update({ where: { id: item.id }, data: { lastPrice: now.price, wasInStock: now.inStock } });
  }
  const allowed = new Set(await promotionalAllowed(prisma, [...changesByUser.keys()]));
  for (const [userId, changes] of changesByUser) {
    if (!allowed.has(userId)) continue;
    const single = changes.length === 1;
    await sendNotification(fcm, prisma, {
      userId,
      type: "WISHLIST_ALERT",
      ...copyFor(changes),
      data: single ? { screen: "product", productId: changes[0].productId } : { screen: "wishlist" },
    });
  }
}
