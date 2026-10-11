import dotenv from "dotenv";
dotenv.config({ override: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../../generated/prisma/index.js";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "out");
export const LOGO_DIR = join(OUT, "logos");
mkdirSync(LOGO_DIR, { recursive: true });

export const prisma = new PrismaClient();

export interface TopBrand { id: string; name: string; products: number; samples: string[] }
export interface DomainEntry { brandId: string; name: string; domain: string | null }
export interface FetchEntry {
  brandId: string;
  name: string;
  domain: string;
  slug: string;
  file: string | null;
  source: string | null;
  kind: string | null;
  reason: string | null;
}

export type Overrides = Record<string, string | null>;

export function readJson<T>(file: string, fallback: T): T {
  const path = join(OUT, file);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

export function writeJson(file: string, data: unknown): void {
  writeFileSync(join(OUT, file), JSON.stringify(data, null, 2));
}

export function loadOverrides(): Overrides {
  return JSON.parse(readFileSync(join(HERE, "overrides.json"), "utf8")) as Overrides;
}

export const slugify = (name: string) =>
  name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function topBrands(limit: number): Promise<TopBrand[]> {
  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
      products: { select: { name: true }, take: 3 },
    },
  });
  return brands
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, limit)
    .map((b) => ({ id: b.id, name: b.name, products: b._count.products, samples: b.products.map((p) => p.name) }));
}
