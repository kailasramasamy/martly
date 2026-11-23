import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createCatalogDraftSchema } from "@martly/shared/schemas";
import { sizeOf, type Reading } from "./reading.js";

const { optimizeImage, putObject } = await import("../../src/services/media.js");

/** Same steps as POST /uploads: re-encode, then store under a fresh key */
async function uploadPhotos(itemFolder: string, count: number) {
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    const file = join(itemFolder, `photo_${i}.jpg`);
    if (!existsSync(file)) throw new Error(`Missing ${file}`);
    const image = await optimizeImage(readFileSync(file));
    urls.push((await putObject(`${randomUUID()}.webp`, image, "image/webp")).url);
  }
  return urls;
}

/** Mirrors POST / in routes/catalog-drafts, without the listing-credit check (SUPER_ADMIN is uncapped there too) */
export async function createItemDraft(
  prisma: PrismaClient, opts: { storeId: string; organizationId: string; userId: string; itemFolder: string; photoCount: number; price: number; reading: Reading },
) {
  const photos = await uploadPhotos(opts.itemFolder, opts.photoCount);
  const body = createCatalogDraftSchema.parse({
    storeId: opts.storeId, photos, mrp: opts.price, sellingPrice: opts.price, stock: 0,
    item: { shape: opts.reading.shape, ...sizeOf(opts.reading), showCapacityOnPhoto: false, reading: opts.reading },
  });
  const { item, ...fields } = body;
  const draft = await prisma.catalogDraft.create({
    data: { ...fields, hintName: null, organizationId: opts.organizationId, createdById: opts.userId, kind: "ITEM", measurement: item },
    select: { id: true },
  });
  return draft.id;
}
