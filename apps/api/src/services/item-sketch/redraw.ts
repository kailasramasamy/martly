import { randomUUID } from "crypto";
import { catalogDraftItemSchema } from "@martly/shared/schemas";
import { estimateCapacityMl, formatCapacityOnPhoto, formatItemSize, type ItemSize } from "@martly/shared/item-size";
import type { CatalogDraftItemInput } from "@martly/shared/schemas";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { putObject } from "../media.js";
import { fetchPhoto } from "../catalog-agent/photos.js";
import type { ProcessedShot } from "../catalog-agent/images.js";
import { shotLegend } from "../catalog-agent/describe-item.js";
import type { Label } from "../catalog-agent/extract.js";
import { bestSizedPhoto, photoWithLegend } from "./size-photo.js";

type Capacity = { capacityMl: number | null; capacityIsEstimate: boolean };

/** The size marked on a cleaned photo; null if every photo kept its background, as the size table still shows it */
export async function drawItemSizeImage(ownerId: string, item: CatalogDraftItemInput, shots: { url: string; legend?: string }[], { capacityMl, capacityIsEstimate }: Capacity) {
  const capacity = item.showCapacityOnPhoto && capacityMl ? formatCapacityOnPhoto(capacityMl, capacityIsEstimate) : null;
  const photos = await Promise.all(shots.map(async ({ url, legend }) => ({ photo: await fetchPhoto(url), legend })));
  const image = await bestSizedPhoto(photos, item, capacity);
  if (!image) return null;
  const { url } = await putObject(`item-sketches/${ownerId}/${randomUUID()}.webp`, image, "image/webp");
  return url;
}

/** Copies of the photos with their view marked, by photo index, for the gallery; the plain ones stay as main image and for finding edges */
export async function drawLegendCopies(ownerId: string, shots: { index: number; url: string; legend: string }[]) {
  const entries = await Promise.all(shots.map(async ({ index, url, legend }) => {
    const image = await photoWithLegend(await fetchPhoto(url), legend);
    const { url: copy } = await putObject(`item-sketches/${ownerId}/${randomUUID()}.webp`, image, "image/webp");
    return [String(index), copy] as const;
  }));
  return Object.fromEntries(entries);
}

/** The gallery with the old size image swapped for the new one, or taken out if there's no new one; a first one goes after the main photo */
function galleryWith(images: string[], previous: string | null, next: string | null) {
  if (next && previous && images.includes(previous)) return images.map((url) => (url === previous ? next : url));
  const others = images.filter((url) => url !== previous);
  return next ? [...others.slice(0, 1), next, ...others.slice(1)] : others;
}

/** After a size is corrected: redraws the size image in its place in the gallery, re-estimates an estimated capacity, and renames a variant still named after its old size */
export async function redrawVariantSketch(prisma: PrismaClient, variantId: string, previous: ItemSize) {
  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    include: { product: { select: { id: true, images: true } } },
  });
  if (!variant.shape) return;
  const draft = await prisma.catalogDraft.findFirst({ where: { productId: variant.productId, kind: "ITEM" }, select: { measurement: true, processedImages: true, extracted: true } });
  const captured = catalogDraftItemSchema.safeParse(draft?.measurement).data;
  const size = { ...variant, shape: variant.shape };
  const capacityMl = variant.capacityIsEstimate ? estimateCapacityMl(size, captured?.reading?.baseScale) : variant.capacityMl;
  const shots = ((draft?.processedImages ?? []) as unknown as ProcessedShot[]).sort((a, b) => a.index - b.index);
  const item = {
    ...size,
    lengthMm: size.lengthMm ?? undefined,
    widthMm: size.widthMm ?? undefined,
    heightMm: size.heightMm ?? undefined,
    topDiameterMm: size.topDiameterMm ?? undefined,
    baseDiameterMm: size.baseDiameterMm ?? undefined,
    reading: captured?.reading,
    showCapacityOnPhoto: captured?.showCapacityOnPhoto ?? false,
  };
  const roles = (draft?.extracted as { label?: Pick<Label, "shots"> } | null)?.label;
  const legended = shots.map((s) => ({ url: s.url, legend: roles ? shotLegend(roles, s.index, variant.shape!) : undefined }));
  const sketchUrl = await drawItemSizeImage(variant.productId, item, legended, { capacityMl, capacityIsEstimate: variant.capacityIsEstimate });
  await prisma.$transaction([
    prisma.productVariant.update({
      where: { id: variantId },
      data: { sketchUrl, capacityMl, ...(variant.name === formatItemSize(previous) ? { name: formatItemSize(size) } : {}) },
    }),
    prisma.product.update({
      where: { id: variant.productId },
      data: { images: galleryWith(variant.product.images, variant.sketchUrl, sketchUrl) },
    }),
  ]);
}
