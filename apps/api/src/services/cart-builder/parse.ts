import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

const MODEL = "claude-haiku-5-5";

const LineSchema = z.object({
  text: z.string().describe("the customer's own words for this item, unchanged"),
  item: z.string().describe("the item as a short shop name, in the customer's language"),
  searchTerm: z.string().describe("the one English name a grocery catalog lists it under, 1-3 words, brand first when named; never two names for the same thing"),
  brand: z.string().nullable(),
  amount: z.number().nullable().describe("how much, converted to the unit below; null when not said"),
  unit: z.enum(["g", "ml", "pcs", "pack"]).nullable(),
  rupees: z.number().nullable().describe("set only when they asked for a money's worth"),
});

const ListSchema = z.object({ lines: z.array(LineSchema) });

export type ParsedLine = z.infer<typeof LineSchema>;

const SYSTEM = `You turn an Indian shopper's grocery list into one line per item. The list may be spoken (run-on, with
filler words) or written, in Tamil, English or a mix (Tanglish). Skip greetings and filler; never invent items.

Amounts: convert weights to g and volumes to ml. kilo/kg = 1000 g, kaal kilo (கால் கிலோ) = 250 g,
arai kilo (அரை கிலோ) = 500 g, mukkaal kilo (முக்கால் கிலோ) = 750 g, litre = 1000 ml, arai litre = 500 ml.
Counts of things (eggs, soap, bananas) are pcs; packets, bottles, boxes and tins are pack.
"10 rupees curry leaves" / "பத்து ரூபாய் கொத்தமல்லி" sets rupees = 10, amount null.

searchTerm: plain English catalog words; keep the brand when they said one ("Aachi chilli powder").`;


export class ListUnreadableError extends Error {}

/**
 * One Claude call: the free text becomes item lines with English search terms and normalised amounts.
 * `glossary` (from the database, see glossary.ts) tells it how shoppers say staples and the catalog word for each.
 */
export async function parseList(text: string, glossary: string) {
  // A shopper is waiting on the cart; the SDK default would let one call run for ten minutes
  const response = await new Anthropic({ timeout: 90_000, maxRetries: 1 }).beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: glossary ? `${SYSTEM}\n\n${glossary}` : SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(ListSchema) },
    messages: [{ role: "user", content: text }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new ListUnreadableError("The list couldn't be read");
  return {
    lines: response.parsed_output.lines,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
