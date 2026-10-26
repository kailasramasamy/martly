import type { PrismaClient } from "../generated/prisma/index.js";

export const ORG_NAME = "Martly Template";
export const STORE_ID = "66dd70fc-98e0-4120-bf7f-13723eaad571";
const DAY_MS = 24 * 60 * 60 * 1000;

/** In-stock products at the store from the named subcategories, `perSub` each, best stocked first. */
export async function pickProducts(prisma: PrismaClient, subcategoryNames: string[], perSub: number) {
  const groups: string[][] = [];
  for (const name of subcategoryNames) {
    const rows = await prisma.product.findMany({
      where: {
        isActive: true, imageUrl: { not: null }, subcategory: { name },
        storeProducts: { some: { storeId: STORE_ID, isActive: true, stock: { gt: 0 } } },
      },
      orderBy: { id: "asc" },
      take: perSub,
      select: { id: true },
    });
    groups.push(rows.map((r) => r.id));
  }
  return groups;
}

interface CollectionSpec {
  slug: string; title: string; subtitle: string; kind: "STANDARD" | "PROMO" | "STORE_SPECIAL"; groups: string[][];
  windowDays?: number; imageUrl?: string | null;
}

/** Creates or refreshes an org collection with exactly these products (group order, then product order). */
export async function upsertCollection(prisma: PrismaClient, organizationId: string, spec: CollectionSpec) {
  const now = new Date();
  const window = spec.windowDays ? { startsAt: now, endsAt: new Date(now.getTime() + spec.windowDays * DAY_MS) } : { startsAt: null, endsAt: null };
  const data = {
    organizationId, title: spec.title, subtitle: spec.subtitle, kind: spec.kind, isActive: true,
    ...window, ...(spec.imageUrl ? { imageUrl: spec.imageUrl } : {}),
  };
  const collection = await prisma.collection.upsert({ where: { slug: spec.slug }, create: { ...data, slug: spec.slug }, update: data });
  const productIds = interleave(spec.groups);
  await prisma.$transaction([
    prisma.collectionItem.deleteMany({ where: { collectionId: collection.id } }),
    prisma.collectionItem.createMany({ data: productIds.map((productId, sortOrder) => ({ collectionId: collection.id, productId, sortOrder })) }),
  ]);
  return { collection, productIds };
}

// Round-robin across groups so the first products shown mix every aisle
function interleave(groups: string[][]) {
  const depth = Math.max(...groups.map((g) => g.length));
  return Array.from({ length: depth }, (_, i) => groups.flatMap((g) => g[i] ?? [])).flat();
}

/** Percentage discounts on the store's listings for these products, running for `days` from now. */
export async function discount(prisma: PrismaClient, productIds: string[], percent: number, days: number) {
  const now = new Date();
  await prisma.storeProduct.updateMany({
    where: { storeId: STORE_ID, productId: { in: productIds }, isActive: true },
    data: { discountType: "PERCENTAGE", discountValue: percent, discountStart: now, discountEnd: new Date(now.getTime() + days * DAY_MS) },
  });
}

/** A live manual promotion record behind a PROMO collection, so its campaign card can state the offer. */
export async function ensurePromo(prisma: PrismaClient, organizationId: string, collection: { id: string; title: string; startsAt: Date | null; endsAt: Date | null }, percent: number) {
  const owner = await prisma.user.findFirstOrThrow({ where: { email: "demo@martly.in" }, select: { id: true } });
  const data = {
    organizationId, createdById: owner.id, brief: `${collection.title}: ${percent}% off`, kind: "MANUAL" as const, status: "LIVE" as const,
    discountType: "PERCENTAGE" as const, discountValue: percent, startsAt: collection.startsAt, endsAt: collection.endsAt, collectionId: collection.id,
  };
  await prisma.promo.upsert({ where: { collectionId: collection.id }, create: data, update: data });
}

/**
 * Puts a section right after the first section matching `after` (by title, else type) in the org's saved layout,
 * creating or updating it by title, then renumbers the layout. Idempotent: a rerun moves it back to the same place.
 */
export async function placeSection(
  prisma: PrismaClient, organizationId: string, after: string,
  section: { type: string; title: string; subtitle?: string; collectionId?: string; config: object; items?: object[] },
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.homeSection.findFirst({ where: { organizationId, title: section.title } });
    const data = { type: section.type as never, title: section.title, subtitle: section.subtitle, collectionId: section.collectionId, config: section.config, isActive: true };
    const saved = existing
      ? await tx.homeSection.update({ where: { id: existing.id }, data })
      : await tx.homeSection.create({ data: { ...data, organizationId } });
    if (section.items) {
      await tx.homeSectionItem.deleteMany({ where: { sectionId: saved.id } });
      await tx.homeSectionItem.createMany({ data: section.items.map((item, sortOrder) => ({ ...item, sectionId: saved.id, sortOrder })) as never });
    }
    const rows = (await tx.homeSection.findMany({ where: { organizationId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }))
      .filter((r) => r.id !== saved.id);
    const anchor = rows.findIndex((r) => r.title === after || r.type === after);
    if (anchor < 0) throw new Error(`No section "${after}" to place "${section.title}" after`);
    const ordered = [...rows.slice(0, anchor + 1), saved, ...rows.slice(anchor + 1)];
    for (const [sortOrder, row] of ordered.entries()) await tx.homeSection.update({ where: { id: row.id }, data: { sortOrder } });
  }, { timeout: 30_000 });
}
