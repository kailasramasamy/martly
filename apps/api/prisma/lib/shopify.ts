// Reads a Shopify store's public products.json feed and normalises it into catalog variants

import type { UnitType } from "../../generated/prisma/index.js";

// `estimated` is not a Shopify field: hand-built feeds set it on approximated MRPs.
// `featured_image` is the size's own pack shot, when the store has one
export interface ShopifyVariant {
  title: string; price: string; compare_at_price: string | null; available: boolean; estimated?: boolean;
  featured_image?: { src: string } | null;
}
export interface ShopifyProduct {
  title: string; handle: string; vendor: string; product_type: string; body_html: string;
  variants: ShopifyVariant[]; images: { src: string }[];
}

export interface PackVariant {
  name: string; unitType: UnitType; unitValue: number;
  mrp: number; onlinePrice: number; available: boolean; note?: string; image?: string;
  // A multipack's single-pack size: the multipack is dropped when that single pack is sold too
  single?: string;
}

// The feed allows 250 per page; robots.txt on these stores typically asks for a 10s crawl delay
export async function fetchShopifyProducts(store: string, delayMs = 10_000): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; ; page++) {
    if (page > 1) await new Promise((r) => setTimeout(r, delayMs));
    const res = await fetch(`${store}/products.json?limit=250&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`${store} products.json page ${page}: HTTP ${res.status}`);
    const { products } = (await res.json()) as { products: ShopifyProduct[] };
    if (!products.length) return all;
    all.push(...products);
  }
}

const UNIT: Record<string, [UnitType, string]> = { g: ["GRAM", "g"], kg: ["KG", "kg"], ml: ["ML", "ml"], l: ["LITER", "L"] };

// "Buy One Get One" / "One Plus One Free": two packs sold for the price of one
const BOGO = /\((?:buy one get one|one plus one)[a-z ]*\)/i;
// "200g", "1 KG"; bundles of single packs are split back into one pack with its own MRP: "50g (Pack of 2)",
// "45 g x 2 (Pack of 2)", "60 gx2 (Buy One Get One)". A bare "20 gX4" is a multipack sold as one, as is any
// size under a title-level "(pack of 6)". `bogo` marks a buy-one-get-one listing whose size label doesn't say so
export function toPackVariant(v: ShopifyVariant, titlePackOf: number, bogo = false): PackVariant | null {
  const label = v.title.trim().toLowerCase().replace(/\s+/g, " ");
  const m = label.replace(BOGO, "(pack of 2)")
    .match(/^(\d+(?:\.\d+)?) ?(g|kg|ml|l) ?(?:x ?([2-9]|1[0-2]))? ?(?:\( ?pack of (\d+) ?\))?$/);
  if (!m) return null;
  const [unitType, unit] = UNIT[m[2]];
  const qty = Number(m[1]);
  const bundle = Number(m[4] ?? (bogo ? 2 : 1));
  const multipack = m[3] && !m[4] ? Number(m[3]) : titlePackOf;
  // No compare-at price means the item isn't discounted: it sells at MRP
  const base = {
    mrp: Number(v.compare_at_price ?? v.price) / bundle, onlinePrice: Number(v.price) / bundle,
    available: v.available, image: v.featured_image?.src,
  };
  if (multipack > 1 && bundle === 1) {
    return { ...base, name: `${multipack} x ${qty}${unit}`, unitType, unitValue: qty * multipack, single: `${qty}${unit}` };
  }
  return { ...base, name: `${qty}${unit}`, unitType, unitValue: qty, note: bundle > 1 ? `split from pack of ${bundle}` : undefined };
}

export function titlePackOf(title: string): number {
  return Number(title.match(/\( ?pack of (\d+) ?\)/i)?.[1] ?? 1);
}

export const isBogoTitle = (title: string) => BOGO.test(title);

const MINOR_WORDS = new Set(["a", "an", "and", "of", "with", "in", "to", "the", "for", "on"]);
const toTitleCase = (title: string) => title.toLowerCase().replace(/\b[a-z][a-z']*/g, (w, i) => (i > 0 && MINOR_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)));

// Offer markers ("(Pack of 2)", "(3x Value Pack)", "(Buy One Get One Free)") and a trailing size ("Sambar Powder 100g",
// "Chilli Powder 100", "Date Bites - 150g") go; sizes come from the variants. A unitless number only counts as a size
// when it's a common pack weight, so "Chicken 65" keeps its name. `titleCase` evens out feeds with ad-hoc casing
export function cleanTitle(title: string, titleCase = false): string {
  const clean = title.replace(/\( ?pack of \d+ ?\)|\(\d+x value pack\)|\((?:buy one get one|one plus one)[a-z ]*\)/gi, " ")
    .replace(/[\s-]+(\d+\s*(g|kg|ml|l)|50|100|200|250|500|1000)\s*$/i, "").replace(/\s*\|\s*/g, " / ").replace(/\s+/g, " ").trim();
  return titleCase ? toTitleCase(clean) : clean;
}

// Plain-text description: tags stripped, entities decoded, cut at a sentence boundary
export function plainDescription(html: string, max = 600): string | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, 200)).trim();
}
