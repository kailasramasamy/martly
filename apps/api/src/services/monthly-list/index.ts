import { lineTotal } from "@martly/shared/offers";
import type { CreateMonthlyListInput, MonthlyListItemsInput, UpdateMonthlyListInput } from "@martly/shared/schemas";
import type { MonthlyListItemView, MonthlyListView } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istNow } from "../ist-day.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../store-product-view.js";
import { listChanges } from "./changes.js";

// The order a new list starts from: the shopper's biggest at the store in this many days
const START_WINDOW_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

type Line = MonthlyListItemsInput["items"][number];
type Translations = MonthlyListItemView["translations"];

const listInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        select: {
          name: true, translations: true, imageUrl: true,
          subcategory: { select: { id: true, category: { select: { id: true, name: true, translations: true } } } },
        },
      },
      variant: { select: { name: true, imageUrl: true, unitType: true, unitValue: true } },
    },
  },
};

/** "2026-11": the IST month a list is for */
export const listMonth = () => istNow().key.slice(0, 7);

/** The list is ready this month (its day has come) and hasn't been ordered yet */
export function isDue(list: { reminderDay: number; lastOrderedMonth: string | null; isActive: boolean }) {
  const { key } = istNow();
  return list.isActive && Number(key.slice(8, 10)) >= list.reminderDay && list.lastOrderedMonth !== key.slice(0, 7);
}

// The order asked for, else the shopper's biggest at the store lately (by amount), as lines in the sizes they bought
async function linesFromOrder(prisma: PrismaClient, userId: string, storeId: string, orderId?: string) {
  const order = await prisma.order.findFirst({
    where: {
      userId, storeId, status: { notIn: ["CANCELLED"] },
      ...(orderId ? { id: orderId } : { createdAt: { gte: new Date(Date.now() - START_WINDOW_DAYS * DAY_MS) } }),
    },
    orderBy: { totalAmount: "desc" },
    select: { createdAt: true, items: { select: { productId: true, variantId: true, quantity: true, unitPrice: true } } },
  });
  if (!order) return null;
  const byVariant = new Map<string, Line & { lastPrice: number }>();
  for (const it of order.items) {
    const line = byVariant.get(it.variantId);
    if (line) line.quantity += it.quantity;
    else byVariant.set(it.variantId, { productId: it.productId, variantId: it.variantId, quantity: it.quantity, lastPrice: Number(it.unitPrice) });
  }
  return { lines: [...byVariant.values()], orderedAt: order.createdAt };
}

/** Creates (or restarts) the shopper's list at a store. Null when it should start from an order and there is none */
export async function createMonthlyList(prisma: PrismaClient, userId: string, input: CreateMonthlyListInput) {
  const fromOrder = input.source === "ORDER" ? await linesFromOrder(prisma, userId, input.storeId, input.orderId) : null;
  if (input.source === "ORDER" && !fromOrder) return null;
  const lines = fromOrder?.lines ?? (input.lines ?? []).map((l) => ({ ...l, lastPrice: null as number | null }));
  const settings = { reminderDay: input.reminderDay, pushOn: input.pushOn, whatsappOn: input.whatsappOn, isActive: true };
  return prisma.$transaction(async (tx) => {
    const list = await tx.monthlyList.upsert({
      where: { userId_storeId: { userId, storeId: input.storeId } },
      create: { userId, storeId: input.storeId, ...settings },
      update: settings,
    });
    await tx.monthlyListItem.deleteMany({ where: { listId: list.id } });
    await tx.monthlyListItem.createMany({
      data: lines.map((l) => ({
        listId: list.id, productId: l.productId, variantId: l.variantId, quantity: l.quantity,
        lastPrice: l.lastPrice, lastOrderedAt: l.lastPrice != null ? fromOrder?.orderedAt : null,
      })),
    });
    return list;
  });
}

// Each line's listing at the store today, any stock level, keyed by variant
async function listingsFor(prisma: PrismaClient, storeId: string, variantIds: string[]) {
  const rows = await prisma.storeProduct.findMany({
    where: { storeId, variantId: { in: variantIds }, isActive: true, product: { isActive: true } },
    include: storeProductInclude,
  });
  const views = await decorateStoreProducts(prisma, rows);
  return new Map(views.map((v) => [v.variantId, v]));
}

export type ListRow = NonNullable<Awaited<ReturnType<typeof loadList>>>;

function loadList(prisma: PrismaClient, userId: string, where: { id: string } | { storeId: string }) {
  return prisma.monthlyList.findFirst({ where: { userId, ...where }, include: listInclude });
}

function itemView(it: ListRow["items"][number], listing: StoreProductView | undefined): MonthlyListItemView<StoreProductView> {
  const category = it.product.subcategory?.category ?? null;
  const price = listing?.pricing.effectivePrice;
  return {
    id: it.id, productId: it.productId, variantId: it.variantId, quantity: it.quantity,
    name: it.product.name, translations: it.product.translations as Translations, variantName: it.variant.name,
    imageUrl: it.product.imageUrl ?? it.variant.imageUrl,
    aisle: category ? { id: category.id, name: category.name, translations: category.translations as Translations } : null,
    listing: listing ?? null,
    inStock: !!listing && listing.availableStock >= it.quantity,
    delta: price != null && it.lastPrice != null ? Math.round(price - Number(it.lastPrice)) : null,
  };
}

/** The shopper's list at a store as it stands today: today's prices, what moved since last time, and what to check */
export async function monthlyListView(prisma: PrismaClient, userId: string, where: { id: string } | { storeId: string }) {
  const list = await loadList(prisma, userId, where);
  if (!list) return null;
  const listings = await listingsFor(prisma, list.storeId, list.items.map((i) => i.variantId));
  const items = list.items.map((it) => itemView(it, listings.get(it.variantId)));
  const total = items.reduce((sum, i) => sum + (i.inStock && i.listing ? lineTotal(i.listing.pricing.effectivePrice, i.quantity, i.listing.pricing.offer) : 0), 0);
  const view: MonthlyListView<StoreProductView> = {
    id: list.id, storeId: list.storeId, reminderDay: list.reminderDay, pushOn: list.pushOn, whatsappOn: list.whatsappOn,
    isActive: list.isActive, lastOrderedMonth: list.lastOrderedMonth, month: listMonth(), due: isDue(list),
    items, total: Math.round(total),
    changes: await listChanges(prisma, userId, list.storeId, list.items, items),
  };
  return view;
}

/** Changes the reminder day, channels or pause; null when the list isn't the shopper's */
export async function updateMonthlyList(prisma: PrismaClient, userId: string, id: string, input: UpdateMonthlyListInput) {
  const { count } = await prisma.monthlyList.updateMany({ where: { id, userId }, data: input });
  return count === 1;
}

/**
 * Replaces the list's lines. Sizes kept stay the same rows (same id and last price), so the app's choices for this month
 * still point at them; false when the list isn't the shopper's
 */
export async function replaceMonthlyListItems(prisma: PrismaClient, userId: string, id: string, input: MonthlyListItemsInput) {
  const list = await prisma.monthlyList.findFirst({ where: { id, userId }, select: { id: true } });
  if (!list) return false;
  // A millisecond apart, so the lines keep the order sent (a swapped line stays in its place)
  const now = Date.now();
  await prisma.$transaction([
    prisma.monthlyListItem.deleteMany({ where: { listId: id, variantId: { notIn: input.items.map((l) => l.variantId) } } }),
    ...input.items.map((l, i) => prisma.monthlyListItem.upsert({
      where: { listId_variantId: { listId: id, variantId: l.variantId } },
      create: { listId: id, productId: l.productId, variantId: l.variantId, quantity: l.quantity, createdAt: new Date(now + i) },
      update: { quantity: l.quantity, createdAt: new Date(now + i) },
    })),
  ]);
  return true;
}

/** An order placed from the list: each line's price this month is remembered, and the month counts as ordered */
export async function recordMonthlyListOrder(prisma: PrismaClient, listId: string, userId: string, orderId: string) {
  const [list, order] = await Promise.all([
    prisma.monthlyList.findFirst({ where: { id: listId, userId }, select: { id: true } }),
    prisma.order.findUnique({ where: { id: orderId }, select: { createdAt: true, items: { select: { variantId: true, unitPrice: true } } } }),
  ]);
  if (!list || !order) return;
  await prisma.$transaction([
    ...order.items.map((it) => prisma.monthlyListItem.updateMany({
      where: { listId, variantId: it.variantId }, data: { lastPrice: it.unitPrice, lastOrderedAt: order.createdAt },
    })),
    prisma.monthlyList.update({ where: { id: listId }, data: { lastOrderedMonth: listMonth() } }),
  ]);
}
