import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { WebShopQuery } from "@martly/shared/schemas";
import type { WebPack, WebProductCard, WebShopStore } from "@martly/shared/types";
import { storePack } from "../pack-images.js";
import { calculateEffectivePrice } from "../pricing.js";
import { resolveStore, webStoreWhere } from "../store-resolve.js";

/** The store a page prices from, and its organisation (kept off the page) */
export interface ShopContext {
  store: WebShopStore;
  organizationId: string;
}

/** The store a page prices from: the shopper's own while it is on martlyshop.in, else their town's main store, else Martly's */
export async function shopStore(prisma: PrismaClient, query: WebShopQuery): Promise<ShopContext | null> {
  const resolution = await resolveStore(prisma, { current: query.store, town: query.town }, webStoreWhere());
  if (!resolution) return null;
  const { id, name, slug, logoUrl, townId, organizationId } = resolution.store;
  const town = await prisma.town.findUniqueOrThrow({ where: { id: townId }, select: { name: true, slug: true } });
  return { store: { id, name, slug, logoUrl, town }, organizationId };
}

/** Launched products the store lists */
export const soldAt = (storeId: string): Prisma.ProductWhereInput => ({
  isActive: true,
  isDraft: false,
  storeProducts: { some: { storeId, isActive: true } },
});

/** Products more stores stock come first: the closest thing to "popular" a new store has */
export const popularFirst: Prisma.ProductOrderByWithRelationInput[] = [{ storeProducts: { _count: "desc" } }, { name: "asc" }];

export const cardSelect = (storeId: string) => ({
  id: true,
  slug: true,
  name: true,
  imageUrl: true,
  brand: { select: { name: true } },
  storeProducts: { where: { storeId, isActive: true }, include: { variant: true } },
}) satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof cardSelect> }>;
type Listing = CardRow["storeProducts"][number];

function toPack(sp: Listing): WebPack {
  const { effectivePrice: price, originalPrice, offer } = calculateEffectivePrice(sp.price, sp.variant, sp);
  const mrp = Math.max(Number(sp.mrp ?? sp.variant.mrp ?? 0), originalPrice);
  const off = mrp > price;
  return {
    id: sp.id,
    name: sp.variant.name,
    price,
    mrp: off ? mrp : null,
    offPercent: off ? Math.round((1 - price / mrp) * 100) : 0,
    inStock: sp.stock - sp.reservedStock > 0,
    offer,
    imageUrl: storePack(sp.storeId, sp.variantId)?.front ?? sp.variant.imageUrl ?? null,
  };
}

export function toCard(row: CardRow): WebProductCard {
  const listings = [...row.storeProducts].sort((a, b) => Number(a.price) - Number(b.price));
  const packs = listings.map(toPack);
  return {
    slug: row.slug,
    name: row.name,
    brand: row.brand?.name ?? null,
    imageUrl: listings.map((sp) => storePack(sp.storeId, sp.variantId)?.front).find(Boolean) ?? row.imageUrl ?? packs.find((p) => p.imageUrl)?.imageUrl ?? null,
    packs,
  };
}

interface CardQuery {
  where: Prisma.ProductWhereInput;
  orderBy?: Prisma.ProductOrderByWithRelationInput[];
  skip?: number;
  take: number;
}

/** Product cards at the store's prices, for products it sells that match */
export async function productCards(prisma: PrismaClient, storeId: string, { where, orderBy = popularFirst, skip, take }: CardQuery) {
  const rows = await prisma.product.findMany({ where: { AND: [soldAt(storeId), where] }, select: cardSelect(storeId), orderBy, skip, take });
  return rows.map(toCard);
}

/** Cards for these products the store sells, by product id */
export async function cardsById(prisma: PrismaClient, storeId: string, ids: string[]) {
  const rows = ids.length ? await prisma.product.findMany({ where: { AND: [soldAt(storeId), { id: { in: ids } }] }, select: cardSelect(storeId) }) : [];
  return new Map(rows.map((row) => [row.id, toCard(row)]));
}

/** Cards for these products, in the order given (e.g. search ranking) */
export async function cardsInOrder(prisma: PrismaClient, storeId: string, ids: string[]) {
  const byId = await cardsById(prisma, storeId, ids);
  return ids.flatMap((id) => byId.get(id) ?? []);
}
