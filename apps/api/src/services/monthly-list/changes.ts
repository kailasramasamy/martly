import type { MonthlyListChange, MonthlyListItemView } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { packDeals } from "../pack-deals.js";
import { predictReorders } from "../reorder.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../store-product-view.js";
import type { ListRow } from "./index.js";
import { closestTo } from "./options.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Not ordered in this long: worth asking whether it's still needed
const LAPSED_DAYS = 60;
// A habit that repeats about monthly belongs on a monthly list
const MONTHLY_MIN_DAYS = 20;
const MONTHLY_MAX_DAYS = 40;
const NEW_USUAL_LIMIT = 3;
const SWAP_CANDIDATES = 30;

type Row = ListRow["items"][number];
type Change = MonthlyListChange<StoreProductView>;

// For a line the store can't fill: the in-stock product in the same subcategory closest in size, then in price
async function swapFor(prisma: PrismaClient, storeId: string, row: Row, price: number | null) {
  const subcategoryId = row.product.subcategory?.id;
  if (!subcategoryId) return null;
  const candidates = (await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, stock: { gt: 0 }, productId: { not: row.productId }, product: { isActive: true, subcategoryId } },
    include: storeProductInclude,
    take: SWAP_CANDIDATES,
  })).filter((sp) => sp.stock - sp.reservedStock >= row.quantity);
  const best = candidates.sort(closestTo(row.variant, price))[0];
  return best ? (await decorateStoreProducts(prisma, [best]))[0] : null;
}

async function outOfStock(prisma: PrismaClient, storeId: string, rows: Row[], items: MonthlyListItemView<StoreProductView>[]) {
  const missing = items.filter((i) => !i.inStock);
  return Promise.all(missing.map(async (item): Promise<Change> => {
    const row = rows.find((r) => r.id === item.id)!;
    const price = item.listing?.pricing.effectivePrice ?? (row.lastPrice != null ? Number(row.lastPrice) : null);
    return { kind: "OUT_OF_STOCK", itemId: item.id, swap: await swapFor(prisma, storeId, row, price) };
  }));
}

// Lines where a bigger pack of the same product costs less for the amount, as the cart offers them
async function biggerPacks(prisma: PrismaClient, storeId: string, items: MonthlyListItemView<StoreProductView>[]) {
  const stocked = items.filter((i) => i.inStock && i.listing);
  const quantities = new Map(stocked.map((i) => [i.listing!.id, i.quantity]));
  const deals = await packDeals(prisma, storeId, stocked.map((i) => i.listing!), quantities, false);
  return deals.flatMap((d): Change[] => {
    const item = stocked.find((i) => i.listing!.id === d.storeProductId);
    return item ? [{ kind: "BIGGER_PACK", itemId: item.id, bigger: d.to, packs: d.quantity, saving: Math.round(d.saves) }] : [];
  });
}

function lapsed(rows: Row[]): Change[] {
  const cutoff = Date.now() - LAPSED_DAYS * DAY_MS;
  return rows
    .filter((r) => r.lastOrderedAt && r.lastOrderedAt.getTime() < cutoff)
    .map((r) => ({ kind: "LAPSED", itemId: r.id, lastOrderedAt: r.lastOrderedAt!.toISOString() }));
}

// Products the shopper buys about every month that the list doesn't have yet, in stock in the size they buy
async function newUsuals(prisma: PrismaClient, userId: string, storeId: string, rows: Row[]) {
  const onList = new Set(rows.map((r) => r.productId));
  const habits = (await predictReorders(prisma, userId, storeId)).filter((p) =>
    p.restockable && p.orderCount >= 2 && !onList.has(p.productId)
    && p.avgIntervalDays != null && p.avgIntervalDays >= MONTHLY_MIN_DAYS && p.avgIntervalDays <= MONTHLY_MAX_DAYS);
  const order = habits.map((h) => h.storeProductId);
  const listings = await prisma.storeProduct.findMany({
    where: { id: { in: order }, storeId, isActive: true, stock: { gt: 0 }, product: { isActive: true } },
    include: storeProductInclude,
  });
  const picked = listings.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, NEW_USUAL_LIMIT);
  return (await decorateStoreProducts(prisma, picked)).map((product): Change => ({ kind: "NEW_USUAL", product }));
}

/** What to settle before ordering: lines out of stock (with a swap), bigger packs that save, lines not bought lately, new usuals */
export async function listChanges(
  prisma: PrismaClient, userId: string, storeId: string, rows: Row[], items: MonthlyListItemView<StoreProductView>[],
) {
  const [missing, bigger, usual] = await Promise.all([
    outOfStock(prisma, storeId, rows, items),
    biggerPacks(prisma, storeId, items),
    newUsuals(prisma, userId, storeId, rows),
  ]);
  return [...missing, ...bigger, ...lapsed(rows), ...usual];
}
