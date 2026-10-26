import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { ApplyStoreOfferInput, EndStoreOfferInput } from "@martly/shared/schemas";
import type { StoreOffer, StoreOfferKind, StoreOfferStatus } from "@martly/shared/types";

// Each kind keeps its own columns on the listing
const COLUMNS = {
  BUY_GET: { set: { offerBuyQty: { not: null } }, start: "offerStart", end: "offerEnd" },
  DISCOUNT: { set: { discountType: { not: null }, discountValue: { gt: 0 } }, start: "discountStart", end: "discountEnd" },
  // Member prices have no dates: always live
  MEMBER_PRICE: { set: { memberPrice: { not: null } }, start: null, end: null },
} as const;

const CLEARED = {
  BUY_GET: { offerBuyQty: null, offerGetQty: null, offerStart: null, offerEnd: null },
  DISCOUNT: { discountType: null, discountValue: null, discountStart: null, discountEnd: null },
  MEMBER_PRICE: { memberPrice: null },
} as const;

function windowWhere(kind: StoreOfferKind, status: StoreOfferStatus, now: Date): Prisma.StoreProductWhereInput {
  const { start, end } = COLUMNS[kind];
  if (!start || !end) return status === "live" ? {} : { id: { in: [] } };
  if (status === "scheduled") return { [start]: { gt: now } };
  if (status === "ended") return { [end]: { lt: now } };
  return { AND: [{ OR: [{ [start]: null }, { [start]: { lte: now } }] }, { OR: [{ [end]: null }, { [end]: { gte: now } }] }] };
}

const SELECT = {
  id: true, price: true, memberPrice: true, offerBuyQty: true, offerGetQty: true, offerStart: true, offerEnd: true,
  discountType: true, discountValue: true, discountStart: true, discountEnd: true,
  product: { select: { name: true, imageUrl: true } }, variant: { select: { name: true } },
} as const;
type Row = Prisma.StoreProductGetPayload<{ select: typeof SELECT }>;

function toOffer(kind: StoreOfferKind, r: Row): StoreOffer {
  const buyGet = kind === "BUY_GET";
  const discount = kind === "DISCOUNT";
  const startsAt = buyGet ? r.offerStart : discount ? r.discountStart : null;
  const endsAt = buyGet ? r.offerEnd : discount ? r.discountEnd : null;
  return {
    id: `${kind}:${r.id}`, kind, storeProductId: r.id,
    productName: r.product.name, imageUrl: r.product.imageUrl, variantName: r.variant.name, price: Number(r.price),
    buy: buyGet ? r.offerBuyQty : null, get: buyGet ? r.offerGetQty : null,
    discountType: discount ? r.discountType : null, discountValue: discount ? Number(r.discountValue) : null,
    memberPrice: kind === "MEMBER_PRICE" ? Number(r.memberPrice) : null,
    startsAt: startsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null,
  };
}

/** A store's offers of both kinds in one status, the soonest to end first, then by product name */
export async function listStoreOffers(
  prisma: PrismaClient,
  query: { storeId: string; status: StoreOfferStatus; q?: string; page: number; pageSize: number },
) {
  const now = new Date();
  const name = query.q ? { product: { name: { contains: query.q, mode: "insensitive" as const } } } : {};
  const kinds = Object.keys(COLUMNS) as StoreOfferKind[];
  const perKind = await Promise.all(kinds.map(async (kind) => {
    const rows = await prisma.storeProduct.findMany({
      where: { storeId: query.storeId, ...COLUMNS[kind].set, ...windowWhere(kind, query.status, now), ...name },
      select: SELECT,
    });
    return rows.map((r) => toOffer(kind, r));
  }));
  const ends = (o: StoreOffer) => (o.endsAt ? Date.parse(o.endsAt) : Infinity);
  const all = perKind.flat().sort((a, b) => ends(a) - ends(b) || a.productName.localeCompare(b.productName));
  const skip = (query.page - 1) * query.pageSize;
  return { items: all.slice(skip, skip + query.pageSize), total: all.length };
}

/** The listings among `ids` that belong to the store; any other id is a mistake or another store's */
export async function storeListings(prisma: PrismaClient, storeId: string, ids: string[]) {
  return prisma.storeProduct.findMany({
    where: { id: { in: ids }, storeId },
    select: { id: true, price: true, product: { select: { name: true } }, variant: { select: { name: true } } },
  });
}

export async function applyStoreOffer(prisma: PrismaClient, input: ApplyStoreOfferInput) {
  if (input.kind === "MEMBER_PRICE") {
    return prisma.$executeRaw`
      UPDATE store_products SET member_price = FLOOR(price * ${100 - input.percentOff} / 100), updated_at = now()
      WHERE id IN (${Prisma.join(input.storeProductIds)}) AND store_id = ${input.storeId}`;
  }
  const data = input.kind === "BUY_GET"
    ? { offerBuyQty: input.buy, offerGetQty: input.get, offerStart: input.startsAt ?? null, offerEnd: input.endsAt ?? null }
    : { discountType: input.discountType, discountValue: input.discountValue, discountStart: input.startsAt ?? null, discountEnd: input.endsAt ?? null };
  const { count } = await prisma.storeProduct.updateMany({ where: { id: { in: input.storeProductIds }, storeId: input.storeId }, data });
  return count;
}

export async function endStoreOffer(prisma: PrismaClient, input: EndStoreOfferInput) {
  const { count } = await prisma.storeProduct.updateMany({
    where: { id: { in: input.storeProductIds }, storeId: input.storeId },
    data: CLEARED[input.kind],
  });
  return count;
}
