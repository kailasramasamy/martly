import type { PrismaClient } from "../../generated/prisma/client.js";
import { mediaUrl, objectExists, putObject } from "./media.js";
import { packRenderHash, renderPack, type PackDesignInput, type PackProductInput } from "./pack-render/index.js";

/** A store's own pack for one pack size */
interface Pack {
  front: string;
  back: string | null;
}

type Design = PackDesignInput & { storeId: string; subcategoryIds: string[]; isDefault: boolean };
type PackProduct = PackProductInput & { subcategoryId: string | null; variants: { id: string; name: string }[] };

// storeId → variantId → pack images; swapped whole on each refresh
let packs = new Map<string, Map<string, Pack>>();
// Storage keys known to exist, so a refresh only checks S3 for new renders
const stored = new Set<string>();

/** The design that packs a product in a store: one made for its subcategory, else the store's default */
function designFor(designs: Design[], subcategoryId: string | null) {
  return (subcategoryId && designs.find((d) => d.subcategoryIds.includes(subcategoryId))) || designs.find((d) => d.isDefault);
}

async function ensureRender(design: Design, product: PackProduct, variant: { id: string; name: string }): Promise<Pack> {
  const hash = packRenderHash(design, product, variant.name);
  const dir = `pack-renders/${design.id}/${variant.id}`;
  const names = { front: `${dir}/front-${hash}.webp`, back: design.backArtUrl ? `${dir}/back-${hash}.webp` : null };
  if (!stored.has(names.front) && !(await objectExists(names.front))) {
    const images = await renderPack(design, product, variant.name);
    if (names.back && images.back) await putObject(names.back, images.back, "image/webp");
    await putObject(names.front, images.front, "image/webp");
  }
  stored.add(names.front);
  return { front: mediaUrl(names.front), back: names.back && mediaUrl(names.back) };
}

async function loadInputs(prisma: PrismaClient) {
  const designs = await prisma.packDesign.findMany({
    where: { isActive: true },
    select: { id: true, storeId: true, template: true, frontArtUrl: true, backArtUrl: true, zones: true, subcategoryIds: true, isDefault: true, updatedAt: true },
  });
  if (!designs.length) return { designs, products: [] };
  const products = await prisma.product.findMany({
    where: { packPhotoUrl: { not: null }, isActive: true },
    select: {
      name: true, ingredients: true, nutritionalInfo: true, translations: true, packPhotoUrl: true, subcategoryId: true,
      variants: { select: { id: true, name: true } },
    },
  });
  return { designs, products: products as PackProduct[] };
}

/** Renders any pack not drawn yet (new design, product or text change) and swaps in the new lookup */
export async function refreshPackImages(prisma: PrismaClient) {
  const { designs, products } = await loadInputs(prisma);
  const byStore = new Map<string, Design[]>();
  for (const d of designs) byStore.set(d.storeId, [...(byStore.get(d.storeId) ?? []), d]);

  const next = new Map<string, Map<string, Pack>>();
  for (const [storeId, storeDesigns] of byStore) {
    const storePacks = new Map<string, Pack>();
    for (const product of products) {
      const design = designFor(storeDesigns, product.subcategoryId);
      if (!design) continue;
      for (const variant of product.variants) storePacks.set(variant.id, await ensureRender(design, product, variant));
    }
    next.set(storeId, storePacks);
  }
  packs = next;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** A store listing (storeId + variantId) shows the store's own pack in place of the catalog photo */
function swapListing(node: Json) {
  const pack = packs.get(node.storeId as string)?.get(node.variantId as string);
  if (!pack) return;
  if (isObject(node.product)) {
    const images = Array.isArray(node.product.images) ? { images: [pack.front, ...(pack.back ? [pack.back] : [])] } : {};
    node.product = { ...node.product, imageUrl: pack.front, ...images };
  }
  if (isObject(node.variant)) node.variant = { ...node.variant, imageUrl: pack.front };
}

/** Rewrites every store listing in a response payload to the store's pack images */
export function applyPackImages(node: unknown): void {
  if (!packs.size) return;
  if (Array.isArray(node)) {
    for (const item of node) applyPackImages(item);
    return;
  }
  if (!isObject(node) || node instanceof Date) return;
  if (typeof node.storeId === "string" && typeof node.variantId === "string") swapListing(node);
  for (const value of Object.values(node)) if (typeof value === "object") applyPackImages(value);
}

/** Product detail seen in a store: each pack size's images become that store's pack, front then back */
export function applyProductPacks<T extends { imageUrl: string | null; images: string[]; variants?: { id: string; imageUrl: string | null }[] }>(
  storeId: string,
  product: T,
): T {
  const storePacks = packs.get(storeId);
  const variants = product.variants ?? [];
  const found = variants.map((v) => storePacks?.get(v.id));
  if (!found.some(Boolean)) return product;
  const images = found.flatMap((p) => (p ? [p.front, ...(p.back ? [p.back] : [])] : []));
  return {
    ...product,
    imageUrl: found.find(Boolean)!.front,
    images,
    variants: variants.map((v, i) => (found[i] ? { ...v, imageUrl: found[i]!.front } : v)),
  };
}
