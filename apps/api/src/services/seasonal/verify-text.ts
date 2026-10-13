import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { BannerCopy } from "./banner-art.js";

const MODEL = "claude-sonnet-5-5";

const ReadBackSchema = z.object({
  headline: z.string().describe("the headline exactly as rendered, character for character"),
  subtitle: z.string().describe("the line under the headline exactly as rendered"),
  button: z.string().describe("the button label exactly as rendered"),
  allExact: z.boolean().describe("true only if all three match the expected text exactly, with nothing cut off, missing, extra or misspelled"),
  issues: z.string().describe("what differs; empty string when allExact"),
});

/**
 * Image models still slip on spelling, especially in Indic scripts, so every text banner is read back
 * before it can reach customers.
 */
export async function bannerTextMatches(image: Buffer, copy: BannerCopy) {
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReadBackSchema) },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/webp", data: image.toString("base64") } },
        {
          type: "text",
          text: `Proofread this banner. Transcribe its text exactly, then compare with what it should say. Grapheme-level differences count (a wrong vowel sign or a missing pulli is a mismatch); font style does not.\n\nExpected headline: ${copy.title}\nExpected subtitle: ${copy.subtitle}\nExpected button: ${copy.cta}`,
        },
      ],
    }],
  });
  const result = response.parsed_output;
  return { ok: response.stop_reason !== "refusal" && result?.allExact === true, issues: result?.issues ?? `stop_reason: ${response.stop_reason}` };
}
