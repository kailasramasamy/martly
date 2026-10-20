import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

const MODEL = "claude-haiku-5-5";

const INSTRUCTIONS = `You translate grocery product names and descriptions into Tamil for a shopping app used in Dharmapuri, Tamil Nadu.
- Write natural everyday Tamil, the way a local shopper would say it, not a literal translation.
- Write brand names in Tamil script (e.g. Aashirvaad → ஆசீர்வாத்); do not translate their meaning.
- Keep pack sizes, numbers and units as written (500g, 1 L, 2 x 100 ml).
- Product name: short, like a shelf label. Description: same meaning and length as the English.`;

const TranslationSchema = z.object({
  name: z.string().describe("The product name in Tamil"),
  description: z.string().nullable().describe("The description in Tamil, or null when there is no English description"),
});

type TaFields = { name?: string; description?: string };
export interface ErrorLog { error: (err: unknown, msg: string) => void }

async function translate(prisma: PrismaClient, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, description: true, translations: true },
  });
  if (!product) return;
  const all = (product.translations ?? {}) as Record<string, TaFields>;
  const ta = all.ta ?? {};
  // The owner's own Tamil stays; only blank fields are filled
  const needName = !ta.name?.trim();
  const needDescription = !!product.description?.trim() && !ta.description?.trim();
  if (!needName && !needDescription) return;

  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: INSTRUCTIONS,
    output_config: { effort: "low", format: betaZodOutputFormat(TranslationSchema) },
    messages: [{ role: "user", content: `Name: ${product.name}\nDescription: ${product.description?.trim() || "(none)"}` }],
  });
  const out = response.parsed_output;
  if (response.stop_reason === "refusal" || !out) return;

  const next: TaFields = {
    ...ta,
    ...(needName ? { name: out.name } : {}),
    ...(needDescription && out.description ? { description: out.description } : {}),
  };
  await prisma.product.update({ where: { id: productId }, data: { translations: { ...all, ta: next } as Prisma.InputJsonValue } });
}

/**
 * Fills a new product's blank Tamil name and description. Never rejects: a failed call leaves the product
 * in English and is logged, so callers can fire it after the save without delaying or failing it.
 */
export async function translateNewProduct(prisma: PrismaClient, productId: string, log: ErrorLog) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  await translate(prisma, productId).catch((err: unknown) => log.error(err, `Tamil translation failed for product ${productId}`));
}
