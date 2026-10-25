import { MAX_PICKS_PER_AISLE } from "@martly/shared/constants";
import type { StorePickInput } from "@martly/shared/schemas";
import type { OwnerPick, VoiceTranslations } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { languageOf } from "../translate/store-voice.js";

/** "Murugan" from "Murugan K" */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The owner's picks among these listings, keyed "storeId:productId", for the badge and the product page's quote */
export async function ownerPicks(prisma: PrismaClient, rows: { storeId: string; productId: string }[]) {
  if (rows.length === 0) return new Map<string, OwnerPick>();
  const picks = await prisma.storePick.findMany({
    where: { storeId: { in: [...new Set(rows.map((r) => r.storeId))] }, productId: { in: [...new Set(rows.map((r) => r.productId))] } },
    select: { storeId: true, productId: true, note: true, language: true, translations: true, author: { select: { name: true } } },
  });
  return new Map(picks.map((p) => [`${p.storeId}:${p.productId}`, {
    note: p.note, language: p.language, translations: p.translations as VoiceTranslations | null, author: firstName(p.author.name),
  }]));
}

// The aisle (category) a product sits in; picks are counted per aisle
async function aisleOf(prisma: PrismaClient, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId }, select: { subcategory: { select: { category: { select: { id: true, name: true } } } } },
  });
  return product?.subcategory?.category ?? null;
}

/** The store's picks in the aisle a product sits in, oldest first, with each product's name and photo */
export async function aislePicks(prisma: PrismaClient, storeId: string, productId: string) {
  const aisle = await aisleOf(prisma, productId);
  const picks = await prisma.storePick.findMany({
    where: { storeId, ...(aisle ? { product: { subcategory: { categoryId: aisle.id } } } : { productId }) },
    orderBy: { createdAt: "asc" },
    select: { id: true, productId: true, note: true, product: { select: { name: true, imageUrl: true } } },
  });
  return { aisle: aisle?.name ?? null, limit: MAX_PICKS_PER_AISLE, picks };
}

export type PickResult = { ok: true; id: string } | { ok: false; reason: "NOT_LISTED" | "AISLE_FULL" };

/** Picks a product (or changes its note); an aisle already holding its share of picks refuses a new one */
export async function savePick(prisma: PrismaClient, authorId: string, input: StorePickInput): Promise<PickResult> {
  const listed = await prisma.storeProduct.count({ where: { storeId: input.storeId, productId: input.productId, isActive: true } });
  if (!listed) return { ok: false, reason: "NOT_LISTED" };
  const existing = await prisma.storePick.findUnique({ where: { storeId_productId: { storeId: input.storeId, productId: input.productId } } });
  const categoryId = (await aisleOf(prisma, input.productId))?.id;
  if (!existing && categoryId) {
    const taken = await prisma.storePick.count({ where: { storeId: input.storeId, product: { subcategory: { categoryId } } } });
    if (taken >= MAX_PICKS_PER_AISLE) return { ok: false, reason: "AISLE_FULL" };
  }
  // A changed note is new words: its old translation no longer fits
  const changed = existing?.note !== input.note;
  const pick = await prisma.storePick.upsert({
    where: { storeId_productId: { storeId: input.storeId, productId: input.productId } },
    create: { storeId: input.storeId, productId: input.productId, authorId, note: input.note, language: languageOf(input.note) },
    update: changed ? { note: input.note, language: languageOf(input.note), translations: Prisma.DbNull, authorId } : {},
  });
  return { ok: true, id: pick.id };
}
