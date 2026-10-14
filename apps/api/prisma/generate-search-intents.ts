/**
 * Generates search-intent data for review: the words shoppers type for each subcategory, and a 0–100
 * recognition score per brand. Writes prisma/data/subcategory-search-terms.json and brand-popularity.json;
 * seed-search-intents.ts loads them. Only adds keys missing from the files, so hand edits survive a re-run.
 *
 *   cd apps/api && npx tsx prisma/generate-search-intents.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";

dotenv.config({ override: true });

const prisma = new PrismaClient();
const client = new Anthropic();
const TERMS_FILE = "prisma/data/subcategory-search-terms.json";
const POPULARITY_FILE = "prisma/data/brand-popularity.json";
const SUBCATEGORY_BATCH = 40;
const BRAND_BATCH = 100;
const CONCURRENCY = 4;

const TERMS_PROMPT = `You map grocery search intent for an Indian quick-commerce app (Tamil Nadu customers, English keyboard).
For each aisle below, list the words and short phrases a shopper would type when they want products from THAT aisle.

Rules:
- lowercase; 4–15 terms per aisle; include singular and plural where people type both
- include everyday English, Indian English, and common Hindi/Tamil words typed in English letters (e.g. "dadhi", "sabun", "arisi")
- include the activity or need the aisle serves ("shaving" for razors, "laundry" for detergent), not just the aisle name
- a term must point clearly to this aisle; skip words that fit many aisles equally ("oil", "pack", "organic", "men")
- never include brand names
Return every slug given, exactly as given.`;

const POPULARITY_PROMPT = `Score how well-known each brand is to grocery shoppers in India, 0–100, within its own categories.
100 = category leader everyone asks for by name (Gillette in razors, Surf Excel in detergent, Amul in butter);
70 = strong national brand; 40 = known regional or niche brand; 15 = little-known, imported, or private label.
Score recognition and sales presence, not quality. Return every slug given, exactly as given.`;

function readJson<T>(file: string): Record<string, T> {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, T>) : {};
}

function writeJson(file: string, data: Record<string, unknown>) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (const group of chunk(items, CONCURRENCY)) results.push(...(await Promise.all(group.map(run))));
  return results;
}

/** One structured-output call: returns { items: [{ slug, value }] } keyed back to slugs. */
async function ask<V>(system: string, lines: string[], valueSchema: object): Promise<Record<string, V>> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: { slug: { type: "string" }, value: valueSchema },
                required: ["slug", "value"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    system,
    messages: [{ role: "user", content: lines.join("\n") }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`Generation stopped: ${response.stop_reason}`);
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No JSON in response");
  const { items } = JSON.parse(text.text) as { items: { slug: string; value: V }[] };
  return Object.fromEntries(items.map((i) => [i.slug, i.value]));
}

async function generateTerms() {
  const existing = readJson<string[]>(TERMS_FILE);
  const subcategories = await prisma.subcategory.findMany({
    where: { slug: { notIn: Object.keys(existing) } },
    select: {
      slug: true, name: true,
      category: { select: { name: true, department: { select: { name: true } } } },
      products: { select: { name: true }, take: 4, where: { isActive: true } },
    },
    orderBy: { slug: "asc" },
  });
  const lines = subcategories.map((s) =>
    `${s.slug} | ${s.category.department.name} > ${s.category.name} > ${s.name} | e.g. ${s.products.map((p) => p.name).join("; ")}`);
  const results = await inBatches(chunk(lines, SUBCATEGORY_BATCH), (batch) =>
    ask<string[]>(TERMS_PROMPT, batch, { type: "array", items: { type: "string" } }));
  const known = new Set(subcategories.map((s) => s.slug));
  const fresh = Object.fromEntries(results.flatMap((r) => Object.entries(r)).filter(([slug]) => known.has(slug))
    .map(([slug, terms]) => [slug, [...new Set(terms.map((t) => t.toLowerCase().trim()).filter(Boolean))]]));
  writeJson(TERMS_FILE, { ...existing, ...fresh });
  console.log(`Search terms: ${Object.keys(fresh).length} new of ${subcategories.length} missing`);
}

async function generatePopularity() {
  const existing = readJson<number>(POPULARITY_FILE);
  const brands = await prisma.brand.findMany({
    where: { slug: { notIn: Object.keys(existing) } },
    select: { slug: true, name: true, products: { select: { subcategory: { select: { name: true } } }, take: 5 } },
    orderBy: { slug: "asc" },
  });
  const lines = brands.map((b) =>
    `${b.slug} | ${b.name} | sells: ${[...new Set(b.products.map((p) => p.subcategory?.name).filter(Boolean))].join(", ")}`);
  const results = await inBatches(chunk(lines, BRAND_BATCH), (batch) =>
    ask<number>(POPULARITY_PROMPT, batch, { type: "integer" }));
  const known = new Set(brands.map((b) => b.slug));
  const fresh = Object.fromEntries(results.flatMap((r) => Object.entries(r)).filter(([slug]) => known.has(slug))
    .map(([slug, score]) => [slug, Math.max(0, Math.min(100, Math.round(score)))]));
  writeJson(POPULARITY_FILE, { ...existing, ...fresh });
  console.log(`Brand popularity: ${Object.keys(fresh).length} new of ${brands.length} missing`);
}

await generateTerms();
await generatePopularity();
await prisma.$disconnect();
