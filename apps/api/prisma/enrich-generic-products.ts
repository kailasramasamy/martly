/**
 * Fill blank details (description, ingredients, nutrition, allergens, storage, shelf life, usage) on the
 * generic master products (no brand, no org) with Claude, in English and Tamil (translations.ta). Only
 * empty fields are written, so hand-entered details stay.
 *
 * Dry run: cd apps/api && npx tsx prisma/enrich-generic-products.ts --limit 5
 * Apply:   ... --apply   (prefix DATABASE_URL=<prod url> for prod)
 */

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { parseArgs } from "node:util";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";

const MODEL = "claude-haiku-5-5";
const CONCURRENCY = 8;

const INSTRUCTIONS = `You write product details for unbranded, generic groceries sold loose or in plain packs by small stores in Tamil Nadu, India.
- Description: 2-3 plain sentences on what it is, how it tastes or is used in Indian (especially South Indian) cooking or homes. No marketing hype, no brand names, no health claims beyond common knowledge.
- Ingredients: for food, what it is made of, e.g. "Toor dal (100%)" or "Gram flour, rice flour, groundnut oil, salt, chilli powder". Fresh produce, meat and fish: the item itself, e.g. "Fresh tomatoes (100%)". Null for non-food items.
- Nutrition: typical values per 100 g (per 100 ml for liquids) from standard food composition data; Energy, Protein, Carbohydrates, Total Sugars, Dietary Fibre, Total Fat, Sodium, plus one or two notable nutrients if well known. Values like "343 kcal", "22.3 g", "17 mg". Empty list for non-food items.
- Allergens: only real ones (Gluten, Milk, Peanut, Tree nuts, Soy, Sesame, Egg, Fish, Crustacean, Mustard). Empty when none.
- Storage, shelf life and usage: practical for an Indian kitchen. Shelf life is days from purchase.
- When an existing English description is given, return it unchanged as the description.
- Tamil: the same description, ingredients, storage, usage and nutrient names in natural everyday Tamil, the way a shopper in Dharmapuri would say it. Keep numbers and units as written (100 g, 22.3 g, kcal).`;

const DetailsSchema = z.object({
  description: z.string(),
  ingredients: z.string().nullable(),
  nutrition: z.array(z.object({ nutrient: z.string(), amount: z.string() })),
  allergens: z.array(z.string()),
  storageType: z.enum(["AMBIENT", "REFRIGERATED", "DEEP_CHILLED", "FROZEN", "COOL_DRY", "HUMIDITY_CONTROLLED"]),
  storageInstructions: z.string(),
  shelfLifeDays: z.number().int(),
  usageInstructions: z.string().nullable().describe("How to use or prepare it, one or two sentences; null if obvious"),
  tamil: z.object({
    description: z.string(),
    ingredients: z.string().nullable(),
    nutrientNames: z.array(z.string()).describe("Tamil names for the nutrition list, in the same order"),
    storageInstructions: z.string(),
    usageInstructions: z.string().nullable(),
  }),
});
type Details = z.infer<typeof DetailsSchema>;

const prisma = new PrismaClient();
const anthropic = new Anthropic();
const blank = (s: string | null) => !s?.trim();

const select = {
  id: true, name: true, description: true, ingredients: true, nutritionalInfo: true, allergens: true,
  storageType: true, storageInstructions: true, shelfLifeDays: true, usageInstructions: true,
  countryOfOrigin: true, productType: true, foodType: true, translations: true,
  subcategory: { select: { name: true, category: { select: { name: true } } } },
  variants: { select: { name: true } },
} satisfies Prisma.ProductSelect;
type Row = Prisma.ProductGetPayload<{ select: typeof select }>;

async function generate(p: Row): Promise<Details | null> {
  const context = [
    `Product: ${p.name}`,
    `Category: ${p.subcategory?.category.name ?? "?"} > ${p.subcategory?.name ?? "?"}`,
    `Type: ${p.productType ?? "?"}, ${p.foodType ?? "?"}`,
    `Pack sizes: ${p.variants.map((v) => v.name).join(", ") || "?"}`,
    `Existing English description: ${p.description?.trim() || "(none)"}`,
  ].join("\n");
  const res = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: INSTRUCTIONS,
    output_config: { effort: "low", format: betaZodOutputFormat(DetailsSchema) },
    messages: [{ role: "user", content: context }],
  });
  return res.stop_reason === "refusal" ? null : res.parsed_output;
}

type TaFields = Record<string, unknown>;

function nutritionTables(p: Row, d: Details) {
  if (!d.nutrition.length) return null;
  const liquid = /\b(ml|l|litre|liter)\b/i.test(p.variants.map((v) => v.name).join(" "));
  const per = liquid ? "100 ml" : "100 g";
  const en = { "Nutrition Per": `${per} (typical values)`, ...Object.fromEntries(d.nutrition.map((n) => [n.nutrient, n.amount])) };
  const ta = {
    "ஊட்டச்சத்து அளவு": `${per} (சராசரி மதிப்புகள்)`,
    ...Object.fromEntries(d.nutrition.map((n, i) => [d.tamil.nutrientNames[i] ?? n.nutrient, n.amount])),
  };
  return { en, ta };
}

function tamilPatch(p: Row, d: Details, nutrition: ReturnType<typeof nutritionTables>) {
  const all = (p.translations ?? {}) as Record<string, TaFields>;
  const ta = all.ta ?? {};
  const fill = (key: string, value: unknown) => (value && !ta[key] ? { [key]: value } : {});
  const next = {
    ...ta,
    ...fill("description", d.tamil.description),
    ...fill("ingredients", d.ingredients && d.tamil.ingredients),
    ...fill("storageInstructions", d.tamil.storageInstructions),
    ...fill("usageInstructions", d.usageInstructions && d.tamil.usageInstructions),
    ...fill("nutritionalInfo", nutrition?.ta),
  };
  return { ...all, ta: next } as Prisma.InputJsonValue;
}

function patch(p: Row, d: Details): Prisma.ProductUpdateInput {
  const nutrition = nutritionTables(p, d);
  return {
    ...(blank(p.description) && { description: d.description }),
    ...(blank(p.ingredients) && d.ingredients && { ingredients: d.ingredients }),
    ...(p.nutritionalInfo == null && nutrition && { nutritionalInfo: nutrition.en }),
    ...(p.allergens.length === 0 && d.allergens.length > 0 && { allergens: d.allergens }),
    ...(p.storageType == null && { storageType: d.storageType }),
    ...(blank(p.storageInstructions) && { storageInstructions: d.storageInstructions }),
    ...(p.shelfLifeDays == null && d.shelfLifeDays > 0 && { shelfLifeDays: d.shelfLifeDays }),
    ...(blank(p.usageInstructions) && d.usageInstructions && { usageInstructions: d.usageInstructions }),
    ...(blank(p.countryOfOrigin) && { countryOfOrigin: "India" }),
    translations: tamilPatch(p, d, nutrition),
  };
}

async function enrich(p: Row, apply: boolean) {
  const details = await generate(p);
  if (!details) return console.log(`REFUSED  ${p.name}`);
  const data = patch(p, details);
  if (!apply) return console.log(JSON.stringify({ name: p.name, ...data }, null, 2));
  await prisma.product.update({ where: { id: p.id }, data });
  console.log(`OK  ${p.name}`);
}

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean" }, limit: { type: "string" } } });
  const rows = await prisma.product.findMany({
    where: {
      brandId: null, organizationId: null,
      OR: [{ description: null }, { description: "" }, { ingredients: null }, { nutritionalInfo: { equals: Prisma.DbNull } }],
    },
    select,
    orderBy: { name: "asc" },
    take: values.limit ? Number(values.limit) : undefined,
  });
  console.log(`${rows.length} products to enrich${values.apply ? "" : " (dry run)"}`);
  const failed: string[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((p) => enrich(p, !!values.apply)));
    results.forEach((r, j) => r.status === "rejected" && failed.push(`${batch[j].name}: ${r.reason}`));
  }
  if (failed.length) console.error(`${failed.length} failed:\n${failed.join("\n")}`);
}

main().finally(() => prisma.$disconnect());
