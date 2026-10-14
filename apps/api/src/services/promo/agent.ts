import Anthropic from "@anthropic-ai/sdk";
import { promoTools, MAX_PRODUCTS, MIN_PRODUCTS, type AgentOutcome, type ToolContext } from "./tools.js";

const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 14;

const SYSTEM = `You build one promotion for Martly, a grocery delivery app for neighbourhood stores in India, from a store
admin's short brief. A promotion is a home-screen banner plus the products listed behind it.

Work like a careful category manager:
- Find the products with the tools. Search the obvious words, synonyms and brands; browse a subcategory when the brief
  names a whole aisle ("fresh fruits"). Only pick products the brief is really about: "natural soap" means bathing
  soaps with natural or herbal ingredients, not detergents or dishwash bars; "paneer" means paneer, not cheese spreads.
- Pick ${MIN_PRODUCTS}-${MAX_PRODUCTS} products, favouring ones in stock at many stores and selling well, with a spread of
  brands and sizes. Put the most appealing first. If fewer than ${MIN_PRODUCTS} genuinely fit, call give_up.
- Discounts: set one only when the brief states it ("5% off", "Rs 20 off", "flat 10"), with exactly the brief's value;
  never invent or adjust one. A "deals" brief with no number means products already on sale (find_on_sale), with
  discount null.
- Never pick alcohol or tobacco. Don't mix vegetarian promos with meat, fish or eggs.
- Copy: an English and a natural Tamil title and subtitle. Include the offer in the title when there is one.
  Write Tamil in everyday native words rather than English words in Tamil script: the banner art renders familiar
  Tamil spellings far more reliably.
- bannerScene: the photographic scene of a wide app banner whose text sits on its left third. Describe an
  appetising, naturally lit still life of the promoted kind of products filling the right two thirds, with a calmer
  left third. Scene only: no text, letters, logos, brand packaging or people's faces.
- push: a short, friendly notification that makes the offer clear. No ALL CAPS, at most one emoji.
- assumptions: note anything you decided that the admin may want to know (duration, brands left out, why).

Finish by calling submit_promo exactly once (or give_up). Don't ask questions; nobody will answer them.`;

/** Runs the promo agent on a brief; the outcome is null only if it ended without submitting or giving up. */
export async function runPromoAgent(ctx: ToolContext, log: (message: string) => Promise<void>): Promise<AgentOutcome | null> {
  const { tools, outcome } = promoTools(ctx);
  const runner = new Anthropic().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools,
    messages: [{ role: "user", content: `Brief: ${ctx.brief}` }],
  });
  for await (const message of runner) {
    const calls = message.content.filter((b) => b.type === "tool_use").map((b) => b.name);
    if (calls.some((name) => name !== "submit_promo" && name !== "give_up")) await log(`Searching the catalogue (${calls.join(", ")})`);
    if (message.stop_reason === "refusal") return { kind: "gave_up", reason: "The model declined this brief." };
    if (outcome()) break;
  }
  return outcome();
}
