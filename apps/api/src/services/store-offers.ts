import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { ApplyStoreOfferInput, EndStoreOfferInput } from "@martly/shared/schemas";
import type { StoreOffer, StoreOfferKind, StoreOfferStatus } from "@martly/shared/types";
import { likeTerm, utc } from "./listing-sql.js";

// Each kind keeps its own columns on the listing; `rank` orders kinds whose offers end together on the same product
const COLUMNS = {
  BUY_GET: { rank: 0, set: Prisma.sql`sp.offer_buy_qty IS NOT NULL`, start: Prisma.sql`sp.offer_start`, end: Prisma.sql`sp.offer_end` },
  DISCOUNT: {
    rank: 1, set: Prisma.sql`sp.discount_type IS NOT NULL AND sp.discount_value > 0`, start: Prisma.sql`sp.discount_start`, end: Prisma.sql`sp.discount_end`,
  },
  // Member prices have no dates: always live
  MEMBER_PRICE: { rank: 2, set: Prisma.sql`sp.member_price IS NOT NULL`, start: null, end: null },
} as const;

const CLEARED = {
  BUY_GET: { offerBuyQty: null, offerGetQty: null, offerStart: null, offerEnd: null },
  DISCOUNT: { discountType: null, discountValue: null, discountStart: null, discountEnd: null },
  MEMBER_PRICE: { memberPrice: null },
} as const;

function inWindow(kind: StoreOfferKind, status: StoreOfferStatus, now: Prisma.Sql) {
  const { start, end } = COLUMNS[kind];
  if (!start || !end) return status === "live" ? Prisma.sql`TRUE` : Prisma.sql`FALSE`;
  if (status === "scheduled") return Prisma.sql`${start} > ${now}`;
  if (status === "ended") return Prisma.sql`${end} < ${now}`;
  return Prisma.sql`(${start} IS NULL OR ${start} <= ${now}) AND (${end} IS NULL OR ${end} >= ${now})`;
}

// One kind's offers in the status, with what the list sorts on
function kindOffers(kind: StoreOfferKind, query: { storeId: string; status: StoreOfferStatus; q?: string }, now: Prisma.Sql) {
  const { rank, set, end } = COLUMNS[kind];
  return Prisma.sql`SELECT sp.id, ${kind} AS kind, ${rank}::int AS rank, ${end ?? Prisma.sql`NULL::timestamp`} AS ends, p.name
    FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE sp.store_id = ${query.storeId} AND ${set} AND ${inWindow(kind, query.status, now)}
      AND (${query.q ?? null}::text IS NULL OR p.name ILIKE ${query.q ? likeTerm(query.q) : null})`;
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

/** A store's offers of every kind in one status, the soonest to end first, then by product name */
export async function listStoreOffers(
  prisma: PrismaClient,
  query: { storeId: string; status: StoreOfferStatus; q?: string; page: number; pageSize: number },
) {
  const now = utc(new Date());
  const kinds = Object.keys(COLUMNS) as StoreOfferKind[];
  // Names sort as the app's lists do (ICU, not the database's byte order), so "amul" sits with "Amul"
  const page = await prisma.$queryRaw<{ id: string; kind: StoreOfferKind; total: number }[]>`
    SELECT id, kind, COUNT(*) OVER()::int AS total FROM (${Prisma.join(kinds.map((k) => kindOffers(k, query, now)), " UNION ALL ")}) o
    ORDER BY ends NULLS LAST, name COLLATE "und-x-icu", rank, id
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: page.map((r) => r.id) } }, select: SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { items: page.map((r) => toOffer(r.kind, byId.get(r.id)!)), total: page[0]?.total ?? (await countOffers(prisma, query, now)) };
}

// The total when the page asked for is past the last offer
async function countOffers(prisma: PrismaClient, query: { storeId: string; status: StoreOfferStatus; q?: string }, now: Prisma.Sql) {
  const kinds = Object.keys(COLUMNS) as StoreOfferKind[];
  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (${Prisma.join(kinds.map((k) => kindOffers(k, query, now)), " UNION ALL ")}) o`;
  return total;
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
