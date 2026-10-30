import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

type Json = Record<string, unknown>;
type Listing = Json & { storeId: string; productId: string; variantId: string };
type BestSizes = Map<string, string>;

// How far back "most bought" looks: long enough for monthly staples, short enough to follow pack changes
const SALES_WINDOW = Prisma.sql`now() - interval '90 days'`;

// Product → its most bought size, in each store and across Martly; refreshed in the background
let storeBest = new Map<string, BestSizes>();
let martlyBest: BestSizes = new Map();

const bestOf = (rows: { productId: string; variantId: string }[]): BestSizes => new Map(rows.map((r) => [r.productId, r.variantId]));

export async function refreshBestSizes(prisma: PrismaClient) {
  const [perStore, overall] = await Promise.all([
    prisma.$queryRaw<{ storeId: string; productId: string; variantId: string }[]>`
      SELECT DISTINCT ON (o.store_id, oi.product_id) o.store_id AS "storeId", oi.product_id AS "productId", oi.variant_id AS "variantId"
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'CANCELLED' AND o.created_at > ${SALES_WINDOW}
      GROUP BY o.store_id, oi.product_id, oi.variant_id
      ORDER BY o.store_id, oi.product_id, SUM(oi.quantity) DESC, oi.variant_id`,
    prisma.$queryRaw<{ productId: string; variantId: string }[]>`
      SELECT DISTINCT ON (oi.product_id) oi.product_id AS "productId", oi.variant_id AS "variantId"
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'CANCELLED' AND o.created_at > ${SALES_WINDOW}
      GROUP BY oi.product_id, oi.variant_id
      ORDER BY oi.product_id, SUM(oi.quantity) DESC, oi.variant_id`,
  ]);
  const byStore = new Map<string, { productId: string; variantId: string }[]>();
  for (const r of perStore) byStore.set(r.storeId, [...(byStore.get(r.storeId) ?? []), r]);
  storeBest = new Map([...byStore].map(([storeId, rows]) => [storeId, bestOf(rows)]));
  martlyBest = bestOf(overall);
}

/** The size each product was last bought in by this shopper, in any store */
async function lastBought(prisma: PrismaClient, userId: string, productIds: string[]): Promise<BestSizes> {
  if (!productIds.length) return new Map();
  return bestOf(await prisma.$queryRaw<{ productId: string; variantId: string }[]>`
    SELECT DISTINCT ON (oi.product_id) oi.product_id AS "productId", oi.variant_id AS "variantId"
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = ${userId} AND o.status <> 'CANCELLED' AND oi.product_id IN (${Prisma.join(productIds)})
    ORDER BY oi.product_id, o.created_at DESC`);
}

const isPlain = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isListing = (v: Json): v is Listing => typeof v.storeId === "string" && typeof v.productId === "string" && typeof v.variantId === "string";

const keyOf = (l: Listing) => `${l.storeId}:${l.productId}`;
const inStock = (l: Listing) => Number(l.stock ?? 0) - Number(l.reservedStock ?? 0) > 0;

/** Every product's in-stock sizes in the payload, per store */
function collectSizes(node: unknown, into: Map<string, Set<string>>) {
  if (Array.isArray(node)) for (const item of node) collectSizes(item, into);
  else if (isPlain(node)) {
    if (isListing(node) && inStock(node)) into.set(keyOf(node), (into.get(keyOf(node)) ?? new Set()).add(node.variantId));
    for (const value of Object.values(node)) if (typeof value === "object") collectSizes(value, into);
  }
}

/** Copies the payload with `preferredSize: true` on each listing whose size the shopper should land on */
function markListings(node: unknown, pick: (l: Listing) => string | undefined): unknown {
  if (Array.isArray(node)) {
    let out: unknown[] | undefined;
    node.forEach((item, i) => {
      const next = markListings(item, pick);
      if (next !== item) (out ??= [...node])[i] = next;
    });
    return out ?? node;
  }
  if (!isPlain(node)) return node;
  let out: Json = node;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value !== "object" || value === null) continue;
    const next = markListings(value, pick);
    if (next !== value) {
      if (out === node) out = { ...node };
      out[key] = next;
    }
  }
  return isListing(out) && pick(out) === out.variantId ? { ...out, preferredSize: true } : out;
}

/**
 * Marks the size a shopper is most likely to buy on every product's listings: the size they bought last, else the store's
 * most bought size, else Martly's, whichever is in stock. The app opens cards and product pages on it; the sizes themselves stay smallest first.
 */
export async function withPreferredSizes(prisma: PrismaClient, payload: unknown, userId: string | undefined): Promise<unknown> {
  const sizes = new Map<string, Set<string>>();
  collectSizes(payload, sizes);
  if (!sizes.size) return payload;
  const productIds = [...new Set([...sizes.keys()].map((k) => k.split(":")[1]))];
  const mine = userId ? await lastBought(prisma, userId, productIds) : new Map<string, string>();
  // The first of these the store has in stock; none means the app's own default (the smallest in stock)
  return markListings(payload, (l) => [mine.get(l.productId), storeBest.get(l.storeId)?.get(l.productId), martlyBest.get(l.productId)]
    .find((v) => v && sizes.get(keyOf(l))?.has(v)));
}
