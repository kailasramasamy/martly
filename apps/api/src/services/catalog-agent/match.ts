import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { MODEL, type Label } from "./extract.js";
import { claudeUsage } from "./usage.js";

const TAXONOMY_TTL_MS = 10 * 60_000;
const MIN_BRAND_SIMILARITY = 0.2;

export interface BrandCandidate {
  id: string;
  name: string;
}

export interface Classification {
  brand: BrandCandidate | null;
  brandConfidence: "high" | "medium" | "low";
  subcategoryId: string | null;
  subcategoryPath: string | null;
  subcategoryConfidence: "high" | "medium" | "low";
}

/** The variant already carrying this EAN, with the org that owns its product (null = master catalog) */
export function findByBarcode(prisma: PrismaClient, barcode: string) {
  return prisma.productVariant.findUnique({
    where: { barcode },
    select: { id: true, productId: true, product: { select: { organizationId: true, name: true } } },
  });
}

/** Closest existing brands by trigram similarity (brands are shared by every organisation) */
export function brandCandidates(prisma: PrismaClient, brandText: string) {
  return prisma.$queryRaw<BrandCandidate[]>`
    SELECT id, name FROM brands
    WHERE similarity(lower(name), lower(${brandText})) >= ${MIN_BRAND_SIMILARITY}
    ORDER BY similarity(lower(name), lower(${brandText})) DESC, popularity DESC
    LIMIT 5`;
}

interface Taxonomy {
  ids: string[];
  paths: string[];
  text: string;
  loadedAt: number;
}
let taxonomy: Taxonomy | null = null;

// Numbered, in a stable order, so the prompt prefix stays byte-identical and cacheable between drafts
async function loadTaxonomy(prisma: PrismaClient): Promise<Taxonomy> {
  if (taxonomy && Date.now() - taxonomy.loadedAt < TAXONOMY_TTL_MS) return taxonomy;
  const rows = await prisma.subcategory.findMany({
    select: { id: true, name: true, category: { select: { name: true, department: { select: { name: true } } } } },
    orderBy: { id: "asc" },
  });
  const paths = rows.map((r) => `${r.category.department.name} > ${r.category.name} > ${r.name}`);
  taxonomy = { ids: rows.map((r) => r.id), paths, text: paths.map((p, i) => `${i + 1}. ${p}`).join("\n"), loadedAt: Date.now() };
  return taxonomy;
}

const PickSchema = z.object({
  brandNumber: z.number().int().describe("Number of the matching existing brand, or 0 if none of them is this brand"),
  brandConfidence: z.enum(["high", "medium", "low"]),
  subcategoryNumber: z.number().int().describe("Number of the best aisle from the list, or 0 if none fits"),
  subcategoryConfidence: z.enum(["high", "medium", "low"]),
});

const INSTRUCTIONS = `You file a new product into an Indian grocery app's catalogue. Pick:
1. The existing brand that is the SAME brand as the pack (spelling variants are fine; a different brand with a similar name is not). 0 if none.
2. The single aisle (Department > Category > Subcategory) where a shopper would look for it. 0 only if nothing fits.
Use "high" confidence only when the choice is clearly right.

Aisles:
`;

function describe(label: Label) {
  return [
    `Product: ${label.name} (${label.variantName})`,
    `Brand on pack: ${label.brand ?? "none"}`,
    `Type: ${label.productType}`,
    label.ingredients ? `Ingredients: ${label.ingredients.slice(0, 300)}` : null,
    `About: ${label.description}`,
  ].filter(Boolean).join("\n");
}

/** One Haiku call picks the brand among the candidates and the subcategory from the full aisle list */
export async function classify(prisma: PrismaClient, label: Label, candidates: BrandCandidate[]) {
  const tax = await loadTaxonomy(prisma);
  const brands = candidates.length ? candidates.map((b, i) => `${i + 1}. ${b.name}`).join("\n") : "(no similar brands)";
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: INSTRUCTIONS + tax.text, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: betaZodOutputFormat(PickSchema) },
    messages: [{ role: "user", content: `${describe(label)}\n\nExisting brands:\n${brands}` }],
  });
  const pick = response.parsed_output;
  const usage = claudeUsage("classify", MODEL, response.usage);
  if (response.stop_reason === "refusal" || !pick) return { result: unclassified(), usage };
  const sub = pick.subcategoryNumber - 1;
  const result: Classification = {
    brand: candidates[pick.brandNumber - 1] ?? null,
    brandConfidence: pick.brandConfidence,
    subcategoryId: tax.ids[sub] ?? null,
    subcategoryPath: tax.paths[sub] ?? null,
    subcategoryConfidence: pick.subcategoryConfidence,
  };
  return { result, usage };
}

function unclassified(): Classification {
  return { brand: null, brandConfidence: "low", subcategoryId: null, subcategoryPath: null, subcategoryConfidence: "low" };
}
