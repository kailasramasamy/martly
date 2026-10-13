import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { FestivalEvent } from "../../../generated/prisma/client.js";
import type { SubcategoryCandidate } from "./candidates.js";

const MODEL = "claude-sonnet-5-5";
const MIN_SUBCATEGORIES = 4;
const MAX_SUBCATEGORIES = 12;

const CurationSchema = z.object({
  skip: z.boolean().describe("true only if the catalog cannot support a credible collection for this event"),
  skipReason: z.string().describe("why it was skipped; empty string otherwise"),
  subcategoryIds: z.array(z.string()).describe(`${MIN_SUBCATEGORIES}-${MAX_SUBCATEGORIES} ids from the list, most relevant first`),
  title: z.string().describe("collection title, 2-4 words, e.g. 'Pongal Essentials'"),
  subtitle: z.string().describe("one line naming what's inside, under 45 characters"),
  titleTa: z.string().describe("natural Tamil title as a Tamil shopper would say it, not a literal translation"),
  subtitleTa: z.string().describe("natural Tamil subtitle"),
  imagePrompt: z.string().describe("the banner's photographic scene, without any text"),
});
export type Curation = z.infer<typeof CurationSchema>;

const SYSTEM = `You curate seasonal shelves for Martly, a grocery delivery app for neighbourhood stores in India.
Given an upcoming festival or season and the subcategories the stores actually stock, choose what shoppers will
genuinely buy for it: ritual and pooja needs, traditional cooking ingredients, sweets, gifting, decor, and the
everyday items demand spikes on. Respect the event's guidance strictly; when a festival is observed vegetarian,
leave out meat, fish and eggs. Never pick alcohol, tobacco, or items that would feel out of place for the occasion.
If fewer than ${MIN_SUBCATEGORIES} subcategories truly fit, set skip to true rather than padding the list.

The imagePrompt describes the photographic scene of a wide app banner whose title, subtitle and button are set
on its left third. Describe a warm, appetising still life of the festival's own foods, props and colours filling
the right two thirds, lit naturally, with the left third falling into a calmer, darker area. Describe the scene
only: no text, letters, logos, brand packaging, or people's faces.

Keep the title to 2-4 words and the subtitle under 45 characters so both read clearly on the banner.`;

export class CurationRefusedError extends Error {}

function describeEvent(event: FestivalEvent) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return [
    `Event: ${event.name} (${event.kind === "SEASON" ? "season" : "festival/occasion"})`,
    `Dates: ${day(event.startsAt)} to ${day(event.endsAt)}`,
    `Regions: ${event.regions.join(", ")}`,
    event.guidance ? `Guidance: ${event.guidance}` : null,
  ].filter(Boolean).join("\n");
}

export async function curateWithClaude(event: FestivalEvent, candidates: SubcategoryCandidate[]): Promise<Curation> {
  const client = new Anthropic();
  const catalog = candidates.map((c) => `${c.id} | ${c.department} > ${c.category} > ${c.name} (${c.products})`).join("\n");
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(CurationSchema) },
    messages: [{
      role: "user",
      content: `${describeEvent(event)}\n\nIn-stock subcategories (id | department > category > subcategory (product count)):\n${catalog}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new CurationRefusedError(`Curator returned no result for ${event.slug} (stop_reason: ${response.stop_reason})`);
  }
  const known = new Set(candidates.map((c) => c.id));
  const result = response.parsed_output;
  const subcategoryIds = [...new Set(result.subcategoryIds.filter((id) => known.has(id)))].slice(0, MAX_SUBCATEGORIES);
  if (!result.skip && subcategoryIds.length < MIN_SUBCATEGORIES) {
    return { ...result, skip: true, skipReason: `Only ${subcategoryIds.length} valid subcategories returned`, subcategoryIds };
  }
  return { ...result, subcategoryIds };
}
