import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { imageBlock } from "./photos.js";
import { claudeUsage } from "./usage.js";

export const MODEL = "claude-haiku-5-5";

const Confidence = z.enum(["high", "medium", "low"]);

export const LabelSchema = z.object({
  shots: z.array(z.object({
    index: z.number().int().describe("0-based position of the photo"),
    role: z.enum(["front", "back", "side", "nutrition", "ingredients", "barcode", "other"]),
  })),
  name: z.string().describe("Brand + product + key variety, as on the pack, without the pack size. e.g. 'Heaven Gate Pumpkin Raw Seeds'"),
  brand: z.string().nullable().describe("Consumer brand on the pack (not the packer/marketer unless that is the only name)"),
  variantName: z.string().describe("Pack size label, e.g. '100g', '1L', '500ml', '10 pcs'"),
  unitType: z.enum(["KG", "GRAM", "LITER", "ML", "PIECE", "PACK", "DOZEN", "BUNDLE"]),
  unitValue: z.number().describe("Number matching unitType, e.g. 100 for 100g"),
  barcode: z.string().nullable().describe("EAN/UPC digits only, and only if every digit is legible"),
  printedMrp: z.number().nullable().describe("MRP printed or stamped on the pack in rupees; null if absent or unreadable"),
  foodType: z.enum(["VEG", "NON_VEG", "VEGAN", "EGG"]).nullable().describe("From the green/brown FSSAI mark; null if no mark"),
  productType: z.enum(["GROCERY", "SNACKS", "BEVERAGES", "DAIRY", "FROZEN", "FRESH_PRODUCE", "BAKERY", "PERSONAL_CARE", "HOUSEHOLD", "BABY_CARE", "PET_CARE", "OTC_PHARMA"]),
  ingredients: z.string().nullable(),
  nutrition: z.array(z.object({ name: z.string(), value: z.string().describe("with unit, e.g. '18.4 g', '464 kcal'") }))
    .describe("Nutrition table rows as printed, including 'Serving Size' / 'Nutrition per' rows; empty if none"),
  allergens: z.array(z.string()),
  fssaiLicense: z.string().nullable(),
  manufacturerName: z.string().nullable().describe("Manufacturer, packer or marketer company name only"),
  countryOfOrigin: z.string().nullable(),
  shelfLifeDays: z.number().int().nullable().describe("'Best before 12 months' = 365"),
  storageType: z.enum(["AMBIENT", "COOL_DRY", "REFRIGERATED", "DEEP_CHILLED", "FROZEN"]).nullable(),
  storageInstructions: z.string().nullable(),
  usageInstructions: z.string().nullable(),
  dangerWarnings: z.string().nullable(),
  description: z.string().describe("2-3 factual sentences for a shopper, from what the pack says; no invented health claims"),
  tags: z.array(z.string()).describe("3-6 lowercase search words a shopper might type"),
  confidence: z.object({ name: Confidence, size: Confidence, brand: Confidence }),
  notes: z.string().describe("Anything unclear or contradictory, else empty"),
});
export type Label = z.infer<typeof LabelSchema>;

const SYSTEM = `You read grocery and FMCG product packs for an Indian store's online catalogue from a store manager's phone photos
(front, back, side, nutrition panel, barcode). Copy facts exactly as printed: numbers, licence numbers, ingredients and nutrition
values character for character. Never guess: use null (or an empty list) for anything that is absent, cut off or unreadable,
and lower the confidence when the photos are blurry or disagree. Ignore other products, people and objects in the background.
Batch numbers and packed/expiry dates are not product facts; leave them out.
Ink-stamped values (net weight, MRP, dates) are often misaligned with their printed captions: read the stamped lines in order
and match them to the captions by sequence (e.g. "100GM / 350/- / 07-2026" under "Net weight / M.R.P. / P.K.D.").`;

export class ExtractRefusedError extends Error {}

/** Reads the label off the original photos; the hint is the staff's own name for the product, if they typed one. */
export async function readLabel(photos: Buffer[], hintName: string | null) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, photo] of photos.entries()) {
    content.push({ type: "text", text: `Photo ${i}:` }, await imageBlock(photo));
  }
  content.push({ type: "text", text: hintName ? `The store manager calls this product "${hintName}".` : "Read this product's pack." });
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(LabelSchema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new ExtractRefusedError("The label reader returned nothing");
  return { label: response.parsed_output, usage: claudeUsage("extract", MODEL, response.usage) };
}
