import type { PrismaClient } from "../../generated/prisma/client.js";
import { storeBrandName, withStoreBrand } from "@martly/shared/constants";
import type { StoreTranslations } from "@martly/shared/schemas";
import { stapleSubcategoryIds } from "./brand-boost.js";

interface StoreBrand { en: string; ta: string }
type Titled = { name: string; brandId: string | null; subcategoryId: string | null; translations?: unknown };
type Json = Record<string, unknown>;

// Store id → the brand its own packs sell under, and the aisles of those packs; refreshed in the background and on a branding change
let brands = new Map<string, StoreBrand>();
let staples = new Set<string>();

export async function refreshStoreBrands(prisma: PrismaClient) {
  const [stores, aisles] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true, brandName: true, translations: true } }),
    stapleSubcategoryIds(prisma),
  ]);
  brands = new Map(stores.map((s) => {
    const en = storeBrandName(s);
    return [s.id, { en, ta: (s.translations as StoreTranslations | null)?.ta?.brandName?.trim() || en }];
  }));
  staples = new Set(aisles);
}

/** The store's brand name, for its brand chip, page and rail tile */
export const storeBrandLabel = (storeId: string, fallback: string) => brands.get(storeId)?.en ?? fallback;

/** A store's own pack: unbranded, in a staples aisle */
const isOwnPack = (p: Pick<Titled, "brandId" | "subcategoryId">) => p.brandId === null && !!p.subcategoryId && staples.has(p.subcategoryId);

/** A product's English title as the store sells it: its own packs carry its brand, as branded products carry theirs */
export function storeTitle(storeId: string, p: Pick<Titled, "name" | "brandId" | "subcategoryId">): string {
  const brand = brands.get(storeId);
  return brand && isOwnPack(p) ? withStoreBrand(p.name, brand.en) : p.name;
}

function retitled<T extends Titled>(storeId: string, p: T): T {
  const brand = brands.get(storeId);
  if (!brand || !isOwnPack(p)) return p;
  const translations = p.translations as Record<string, { name?: string }> | null | undefined;
  const ta = translations?.ta;
  return {
    ...p,
    name: withStoreBrand(p.name, brand.en),
    ...(ta?.name ? { translations: { ...translations, ta: { ...ta, name: withStoreBrand(ta.name, brand.ta) } } } : {}),
  };
}

const isPlain = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isTitled = (v: Json): v is Json & Titled => typeof v.name === "string" && "brandId" in v && "subcategoryId" in v;

/**
 * A response with every store's own packs titled under its brand. The store comes from the nearest `storeId` above a
 * product (a listing, cart or order), else the request's. Copies what it changes, so cached objects stay untouched.
 */
export function withStoreBrandNames(node: unknown, storeId: string | undefined): unknown {
  if (!brands.size) return node;
  if (Array.isArray(node)) {
    let out: unknown[] | undefined;
    node.forEach((item, i) => {
      const next = withStoreBrandNames(item, storeId);
      if (next !== item) (out ??= [...node])[i] = next;
    });
    return out ?? node;
  }
  if (!isPlain(node)) return node;
  const store = typeof node.storeId === "string" ? node.storeId : storeId;
  let out: Json = node;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value !== "object" || value === null) continue;
    const next = withStoreBrandNames(value, store);
    if (next !== value) {
      if (out === node) out = { ...node };
      out[key] = next;
    }
  }
  return store && isTitled(out) ? retitled(store, out) : out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A search with the store's own brand taken out ("ranga toor dal" → "toor dal"), so it finds the packs it names */
export function withoutStoreBrand(storeId: string, query: string): string {
  const brand = brands.get(storeId)?.en;
  if (!brand) return query;
  const rest = query.replace(new RegExp(`(^|\\s)${escapeRegExp(brand)}(?=\\s|$)`, "gi"), " ").trim().replace(/\s+/g, " ");
  return rest || query;
}
