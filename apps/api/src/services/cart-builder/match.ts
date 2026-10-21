import type { CartBuilderCandidate, CartBuilderLine } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { searchProducts } from "../search.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../store-product-view.js";
import type { ParsedLine } from "./parse.js";
import { packSize, pickPack } from "./variant-pick.js";

/** The variant a customer buys most of each product they've ordered at the store */
export type Bought = Map<string, { variantId: string; orderCount: number }>;

// Search hits kept per line; a product bought before is kept wherever it ranks
const TOP_PRODUCTS = 16;
const OFFERED = 10;
// Lines matched at once: each search is a heavy query, so keep a long list from draining the pool
const PARALLEL = 5;

/**
 * Ranked product IDs for a line. The parsed term is already clean, so a plain keyword search comes first; the slow
 * fuzzy and full-text fallbacks run only when it finds nothing, then the customer's own words (Tamil-only names).
 */
async function searchLine(prisma: PrismaClient, storeId: string, line: ParsedLine, bought: Bought) {
  let { productIds } = await searchProducts(prisma, storeId, line.searchTerm, { exact: true });
  if (productIds.length === 0) ({ productIds } = await searchProducts(prisma, storeId, line.searchTerm));
  if (productIds.length === 0 && line.item !== line.searchTerm) ({ productIds } = await searchProducts(prisma, storeId, line.item));
  return [...productIds.slice(0, TOP_PRODUCTS), ...productIds.slice(TOP_PRODUCTS).filter((id) => bought.has(id))];
}

/** In-stock store products for a line's hits, one group per product, in search order */
async function loadInStock(prisma: PrismaClient, storeId: string, productIds: string[]) {
  if (productIds.length === 0) return [];
  const rows = await decorateStoreProducts(prisma, await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, productId: { in: productIds }, product: { isActive: true } },
    include: storeProductInclude,
  }));
  const byProduct = new Map<string, StoreProductView[]>();
  for (const sp of rows.filter((r) => r.availableStock > 0)) byProduct.set(sp.productId, [...(byProduct.get(sp.productId) ?? []), sp]);
  return productIds.map((id) => byProduct.get(id)).filter((g): g is StoreProductView[] => g !== undefined);
}

function brandMatches(group: StoreProductView[], brand: string | null) {
  const name = group[0].product.brand?.name.toLowerCase();
  return Boolean(brand && name && (name.includes(brand.toLowerCase()) || brand.toLowerCase().includes(name)));
}

// Ten candidates a line, each with its sizes, adds up on a long list: drop the text the product cards never show
function forCard(sp: StoreProductView) {
  const {
    description, ingredients, nutritionalInfo, allergens, storageInstructions, usageInstructions, dangerWarnings, searchText, variants, images,
    subcategory, ...product
  } = sp.product;
  const names = (t: unknown) => Object.fromEntries(Object.entries((t ?? {}) as Record<string, { name?: string }>).map(([lang, v]) => [lang, { name: v.name }]));
  return {
    ...sp,
    product: {
      ...product,
      translations: names(product.translations),
      subcategory: subcategory && { id: subcategory.id, name: subcategory.name, slug: subcategory.slug, translations: names(subcategory.translations) },
    },
  };
}

export type CardProduct = ReturnType<typeof forCard>;

function toCandidate(group: StoreProductView[], line: ParsedLine, bought: Bought): CartBuilderCandidate<CardProduct> {
  const usualVariant = bought.get(group[0].productId)?.variantId;
  const options = group.map((sp) => ({ size: packSize(sp.variant.unitType, Number(sp.variant.unitValue)), price: sp.pricing.effectivePrice }));
  const { index, quantity } = pickPack(options, line, group.findIndex((sp) => sp.variantId === usualVariant));
  const sp = group[index];
  const sizes = group
    .map((g, i) => ({ g, amount: options[i].size.amount }))
    .filter(({ g }) => g !== sp)
    .sort((a, b) => a.amount - b.amount)
    .map(({ g }) => forCard(g));
  return { storeProduct: forCard(sp), sizes, quantity: Math.min(quantity, sp.availableStock), boughtBefore: bought.has(sp.productId) };
}

/**
 * Ranks one line's in-stock products. A product is added for the customer (MATCHED) only when they named its brand
 * or have bought it here before; otherwise they pick from the best ten. A lone search hit isn't enough: "dish soap"
 * with one hit can be a kitchen cleaner.
 */
function matchLine(line: ParsedLine, groups: StoreProductView[][], bought: Bought, brandOnly = false): CartBuilderLine<CardProduct> {
  const score = (g: StoreProductView[]) => (brandMatches(g, line.brand) ? 2 : 0) + (bought.has(g[0].productId) ? 1 : 0);
  const orders = (g: StoreProductView[]) => bought.get(g[0].productId)?.orderCount ?? 0;
  const ranked = [...groups].sort((a, b) => score(b) - score(a) || orders(b) - orders(a)).slice(0, OFFERED);
  return {
    text: line.text,
    item: line.item,
    // Found by brand alone, the item word didn't match, so it's never added for them ("Rin soap" isn't Rin powder)
    confidence: ranked.length === 0 ? "NOT_FOUND" : score(ranked[0]) > 0 && !brandOnly ? "MATCHED" : "PICK",
    candidates: ranked.map((g) => toCandidate(g, line, bought)),
  };
}

/**
 * A line's in-stock products. When it names a brand the search didn't find (the catalog calls Rin's bar a "detergent
 * bar", not "soap"), that brand's own products come first.
 */
async function findGroups(prisma: PrismaClient, storeId: string, line: ParsedLine, bought: Bought) {
  const groups = await loadInStock(prisma, storeId, await searchLine(prisma, storeId, line, bought));
  if (!line.brand || groups.some((g) => brandMatches(g, line.brand))) return { groups, brandOnly: false };
  const { productIds } = await searchProducts(prisma, storeId, line.brand, { exact: true });
  const ofBrand = (await loadInStock(prisma, storeId, productIds.slice(0, TOP_PRODUCTS))).filter((g) => brandMatches(g, line.brand));
  return ofBrand.length > 0 ? { groups: [...ofBrand, ...groups], brandOnly: true } : { groups, brandOnly: false };
}

/**
 * Matches parsed lines against the store, a few at a time, handing each to `onLine` as soon as it's done so the
 * shopper sees products while the rest are still being found. Resolves with every line in list order.
 */
export async function matchLines(
  prisma: PrismaClient,
  storeId: string,
  lines: ParsedLine[],
  bought: Bought,
  onLine?: (index: number, line: CartBuilderLine<CardProduct>) => void,
) {
  const matched: CartBuilderLine<CardProduct>[] = new Array(lines.length);
  let next = 0;
  const worker = async () => {
    while (next < lines.length) {
      const i = next++;
      const { groups, brandOnly } = await findGroups(prisma, storeId, lines[i], bought);
      matched[i] = matchLine(lines[i], groups, bought, brandOnly);
      onLine?.(i, matched[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, lines.length) }, worker));
  return matched;
}
