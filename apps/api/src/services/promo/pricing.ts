import { Prisma, type DiscountType, type PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

interface Discount {
  discountType: DiscountType | null;
  discountValue: Prisma.Decimal | number | null;
  discountStart: Date | null;
  discountEnd: Date | null;
}

export interface PromoOffer {
  organizationId: string;
  productIds: string[];
  type: DiscountType;
  value: number;
  startsAt: Date;
  endsAt: Date;
}

/** A discount as a percentage of price, so FLAT and PERCENTAGE offers compare fairly. */
export function percentOff(type: DiscountType | null, value: Prisma.Decimal | number | null, price: number) {
  if (!type || value == null || price <= 0) return 0;
  return type === "PERCENTAGE" ? Number(value) : (Number(value) / price) * 100;
}

const overlaps = (d: Discount, from: Date, to: Date) =>
  Boolean(d.discountType) && Number(d.discountValue ?? 0) > 0
  && (!d.discountStart || d.discountStart <= to) && (!d.discountEnd || d.discountEnd >= from);

// The store discount wins over the variant's whenever it's live (services/pricing.ts), so that's what a shopper gets
function existingPercent(listing: Discount & { price: Prisma.Decimal; variant: Discount }, from: Date, to: Date) {
  const price = Number(listing.price);
  if (overlaps(listing, from, to)) return percentOff(listing.discountType, listing.discountValue, price);
  if (overlaps(listing.variant, from, to)) return percentOff(listing.variant.discountType, listing.variant.discountValue, price);
  return 0;
}

const DISCOUNT_FIELDS = { discountType: true, discountValue: true, discountStart: true, discountEnd: true } as const;

/** The org's active listings of the promo's products, split into those the offer improves and those it leaves alone. */
export async function planChanges(db: Db, offer: PromoOffer) {
  const listings = await db.storeProduct.findMany({
    where: { productId: { in: offer.productIds }, isActive: true, store: { organizationId: offer.organizationId, status: "ACTIVE" } },
    select: { id: true, storeId: true, price: true, ...DISCOUNT_FIELDS, variant: { select: DISCOUNT_FIELDS } },
  });
  const change = listings.filter((l) => {
    const ours = percentOff(offer.type, offer.value, Number(l.price));
    return ours > existingPercent(l, offer.startsAt, offer.endsAt);
  });
  return { change, keptExisting: listings.length - change.length, stores: new Set(change.map((l) => l.storeId)).size };
}

/** Writes the offer onto the listings, recording each one's previous discount for restoreChanges. */
export async function applyChanges(tx: Prisma.TransactionClient, promoId: string, offer: PromoOffer) {
  const { change, keptExisting, stores } = await planChanges(tx, offer);
  await tx.promoPriceChange.createMany({
    data: change.map((l) => ({
      promoId, storeProductId: l.id,
      prevDiscountType: l.discountType, prevDiscountValue: l.discountValue,
      prevDiscountStart: l.discountStart, prevDiscountEnd: l.discountEnd,
    })),
  });
  await tx.storeProduct.updateMany({
    where: { id: { in: change.map((l) => l.id) } },
    data: { discountType: offer.type, discountValue: offer.value, discountStart: offer.startsAt, discountEnd: offer.endsAt },
  });
  return { listings: change.length, stores, keptExisting };
}

/**
 * Puts back each listing's previous discount, but only where the promo's discount is still in place:
 * a manual edit made while the promo ran wins. Listings are grouped by their previous discount to batch the writes.
 */
export async function restoreChanges(tx: Prisma.TransactionClient, promoId: string, offer: Omit<PromoOffer, "productIds" | "organizationId">) {
  const changes = await tx.promoPriceChange.findMany({ where: { promoId, restoredAt: null } });
  const groups = new Map<string, typeof changes>();
  for (const c of changes) {
    const key = JSON.stringify([c.prevDiscountType, c.prevDiscountValue, c.prevDiscountStart, c.prevDiscountEnd]);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const group of groups.values()) {
    const prev = group[0];
    await tx.storeProduct.updateMany({
      where: {
        id: { in: group.map((c) => c.storeProductId) },
        discountType: offer.type, discountValue: offer.value, discountStart: offer.startsAt, discountEnd: offer.endsAt,
      },
      data: {
        discountType: prev.prevDiscountType, discountValue: prev.prevDiscountValue,
        discountStart: prev.prevDiscountStart, discountEnd: prev.prevDiscountEnd,
      },
    });
  }
  await tx.promoPriceChange.updateMany({ where: { promoId, restoredAt: null }, data: { restoredAt: new Date() } });
}
