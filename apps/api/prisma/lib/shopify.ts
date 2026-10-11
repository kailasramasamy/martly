// Reads a Shopify store's public products.json feed and normalises it into catalog variants

import type { UnitType } from "../../generated/prisma/index.js";

export interface ShopifyVariant { title: string; price: string; compare_at_price: string | null; available: boolean }
export interface ShopifyProduct {
  title: string; handle: string; product_type: string; body_html: string;
  variants: ShopifyVariant[]; images: { src: string }[];
}

export interface PackVariant {
  name: string; unitType: UnitType; unitValue: number;
  mrp: number; onlinePrice: number; available: boolean; note?: string;
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

// "200g", "1 KG", "50g (Pack of 2)" → one single-pack variant; a title-level "(pack of 6)" makes a multipack ("6 x 15g")
export function toPackVariant(v: ShopifyVariant, titlePackOf: number): PackVariant | null {
  const m = v.title.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\s*(?:\(pack of (\d+)\))?$/);
  if (!m || !v.compare_at_price) return null;
  const [unitType, label] = UNIT[m[2]];
  const qty = Number(m[1]);
  const bundle = Number(m[3] ?? 1);
  const base = { mrp: Number(v.compare_at_price) / bundle, onlinePrice: Number(v.price) / bundle, available: v.available };
  if (titlePackOf > 1) {
    return { ...base, name: `${titlePackOf} x ${qty}${label}`, unitType, unitValue: qty * titlePackOf };
  }
  return { ...base, name: `${qty}${label}`, unitType, unitValue: qty, note: bundle > 1 ? `split from pack of ${bundle}` : undefined };
}

export function titlePackOf(title: string): number {
  return Number(title.match(/\(pack of (\d+)\)/i)?.[1] ?? 1);
}

export function cleanTitle(title: string): string {
  return title.replace(/\(pack of \d+\)/i, "").replace(/\s*\|\s*/g, " / ").replace(/\s+/g, " ").trim();
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
