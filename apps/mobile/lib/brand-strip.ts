import type { StoreProduct } from "./types";

export interface BrandTile {
  id: string;
  name: string;
  count: number;
  imageUrl?: string | null;
}

// Pastel background + matching ink per brand, picked stably from the brand name
const WORDMARK_COLORS = [
  ["#fde7d3", "#9a3412"], ["#e0f2fe", "#075985"], ["#dcfce7", "#166534"], ["#fef3c7", "#92400e"],
  ["#ede9fe", "#5b21b6"], ["#fce7f3", "#9d174d"], ["#ccfbf1", "#115e59"], ["#fee2e2", "#991b1b"],
];

export function wordmarkColors(name: string): [background: string, ink: string] {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return WORDMARK_COLORS[hash % WORDMARK_COLORS.length] as [string, string];
}

// Mix a hex colour toward black (amount 0–1)
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// A brand's store colours: its own themeColor when set, else the stable wordmark ink; accent is its second logo colour, if any
export function brandTheme(brand: { name: string; themeColor?: string | null; themeColorSecondary?: string | null }) {
  const base = brand.themeColor ?? wordmarkColors(brand.name)[1];
  return { base, dark: shade(base, 0.35), accent: brand.themeColorSecondary ?? base };
}

// "Fortune (Adani Wilmar)" → "Fortune": the parenthetical is the parent company
export const brandDisplayName = (name: string) => name.replace(/\s*\(.*\)\s*/g, " ").trim();

export const MIN_BRANDS_FOR_STRIP = 3;

interface BrandAccumulator {
  name: string;
  imageUrl: string | null;
  productIds: Set<string>;
}

function addProduct(acc: Map<string, BrandAccumulator>, { product }: StoreProduct): void {
  const brand = product.brand;
  if (!brand) return;
  let entry = acc.get(brand.id);
  if (!entry) {
    entry = { name: brand.name, imageUrl: brand.imageUrl ?? null, productIds: new Set() };
    acc.set(brand.id, entry);
  }
  entry.productIds.add(product.id);
}

// Every brand among the products, most products first
export function brandsFromProducts(products: StoreProduct[]): BrandTile[] {
  const acc = new Map<string, BrandAccumulator>();
  for (const sp of products) addProduct(acc, sp);
  return Array.from(acc, ([id, e]) => ({ id, name: e.name, imageUrl: e.imageUrl, count: e.productIds.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
