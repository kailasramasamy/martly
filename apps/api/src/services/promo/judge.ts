import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { ProductFacts } from "./catalog.js";

const MODEL = "claude-haiku-5-5";

const VerdictSchema = z.object({
  verdicts: z.array(z.object({
    productId: z.string(),
    keep: z.boolean(),
    reason: z.string().describe("a few words, only when dropping"),
  })),
});

const SYSTEM = `You check a grocery promotion before it goes live. Given the admin's brief and the products chosen for it,
keep a product only if a shopper reading the brief would expect to find it there. Drop anything off-topic: a dishwash
bar in a soap promo, a cheese spread in a paneer promo, a juice in a fresh fruit promo. When the brief names a
discount, judge only whether the product fits the brief's subject.`;

export class JudgeRefusedError extends Error {}

/** Second opinion on relevance: returns the products to keep, in their original order, and why others were dropped. */
export async function judgeProducts(brief: string, products: ProductFacts[]) {
  const list = products.map((p) => `${p.id} | ${p.name} | ${p.brand ?? "no brand"} | ${p.subcategory ?? "-"}`).join("\n");
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(VerdictSchema) },
    messages: [{ role: "user", content: `Brief: ${brief}\n\nProducts:\n${list}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new JudgeRefusedError("The relevance check returned no verdict");
  const dropped = new Map(response.parsed_output.verdicts.filter((v) => !v.keep).map((v) => [v.productId, v.reason]));
  return {
    kept: products.filter((p) => !dropped.has(p.id)),
    dropped: products.filter((p) => dropped.has(p.id)).map((p) => `${p.name} (${dropped.get(p.id)})`),
  };
}
