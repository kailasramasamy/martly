import { createHash } from "node:crypto";
import sharp from "sharp";
import { printOnPouch } from "./print.js";
import { PACK_TEMPLATES } from "./templates.js";
import { fillZones, type PackText, type PackZone } from "./zones.js";

export { PACK_TEMPLATES } from "./templates.js";
export type { PackZone } from "./zones.js";

/** Bump when the renderer's output changes, so every pack is drawn again */
const RENDER_VERSION = 2;
// Table header rows of a nutrition label, not nutrients
const NUTRITION_META = new Set(["nutrition per", "serving size", "servings per pack"]);
// Label order on Indian packs; the JSON column keeps no key order
const NUTRIENT_ORDER = [/energy/, /protein/, /carbohydrate/, /sugar/, /fib/, /fat/, /cholesterol/, /sodium/];
const nutrientRank = (label: string) => {
  const i = NUTRIENT_ORDER.findIndex((re) => re.test(label.toLowerCase()));
  return i < 0 ? NUTRIENT_ORDER.length : i;
};

export interface PackDesignInput {
  id: string;
  template: string;
  frontArtUrl: string;
  backArtUrl: string | null;
  zones: unknown;
  updatedAt: Date;
}

export interface PackProductInput {
  name: string;
  ingredients: string | null;
  nutritionalInfo: unknown;
  translations: unknown;
  packPhotoUrl: string;
}

// Artwork and pouch photos live at immutable media URLs, so a fetched copy never goes stale
const media = new Map<string, Promise<Buffer>>();

function fetchMedia(url: string) {
  let pending = media.get(url);
  if (!pending) {
    pending = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`Pack media ${url} returned ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    });
    pending.catch(() => media.delete(url));
    media.set(url, pending);
  }
  return pending;
}

function packText(product: PackProductInput, variantName: string): PackText {
  const ta = (product.translations as { ta?: { name?: string } } | null)?.ta?.name;
  const nutrition = Object.entries((product.nutritionalInfo ?? {}) as Record<string, unknown>)
    .filter(([label, value]) => !NUTRITION_META.has(label.toLowerCase()) && typeof value === "string")
    .map(([label, value]) => [label, value as string] as [string, string])
    .sort(([a], [b]) => nutrientRank(a) - nutrientRank(b));
  return {
    nameEn: product.name,
    nameTa: ta ?? product.name,
    netWeight: variantName,
    ingredients: product.ingredients ?? product.name,
    nutrition,
  };
}

/** Changes whenever anything printed on the pack changes, so a render's storage key is safe to cache forever */
export function packRenderHash(design: PackDesignInput, product: PackProductInput, variantName: string) {
  const inputs = [RENDER_VERSION, design.id, design.updatedAt.toISOString(), product.packPhotoUrl, packText(product, variantName)];
  return createHash("sha1").update(JSON.stringify(inputs)).digest("hex").slice(0, 12);
}

/** Draws a store's pack design for one pack size: the front, and the back when the design has one (WebP) */
export async function renderPack(design: PackDesignInput, product: PackProductInput, variantName: string) {
  const template = PACK_TEMPLATES[design.template];
  if (!template) throw new Error(`Pack design ${design.id} uses unknown template ${design.template}`);
  const zones = design.zones as PackZone[];
  const text = packText(product, variantName);
  const photo = await fetchMedia(product.packPhotoUrl);

  const side = async (artUrl: string, which: PackZone["side"], pouch: Buffer) => {
    const art = await fillZones(await fetchMedia(artUrl), zones, which, text);
    return (await printOnPouch(pouch, art, template)).webp({ quality: 82 }).toBuffer();
  };
  const front = await side(design.frontArtUrl, "front", photo);
  // No back photo yet: the front pouch mirrored, so the light still falls naturally
  const back = design.backArtUrl
    ? await side(design.backArtUrl, "back", await sharp(photo).flop().png().toBuffer())
    : null;
  return { front, back };
}
