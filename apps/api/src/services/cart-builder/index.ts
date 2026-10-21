import type { CartBuilderSource } from "@martly/shared/constants";
import type { CartBuilderEvent, CartBuilderLine } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { predictReorders } from "../reorder.js";
import { matchLines, type Bought, type CardProduct } from "./match.js";
import { glossaryPrompt, storeLanguages } from "./glossary.js";
import { parseList } from "./parse.js";

export { ListUnreadableError } from "./parse.js";

async function boughtByProduct(prisma: PrismaClient, userId: string, storeId: string): Promise<Bought> {
  const bought: Bought = new Map();
  for (const p of await predictReorders(prisma, userId, storeId)) {
    const seen = bought.get(p.productId);
    if (!seen || p.orderCount > seen.orderCount) bought.set(p.productId, { variantId: p.variantId, orderCount: p.orderCount });
  }
  return bought;
}

export type BuildEvent = CartBuilderEvent<CardProduct>;
type BuildInput = { userId: string; storeId: string; text: string; language?: string };

/** Reads the list with the glossary for the store's languages, alongside what the customer has bought there */
async function readList(prisma: PrismaClient, input: BuildInput) {
  const glossary = await glossaryPrompt(prisma, await storeLanguages(prisma, input.storeId, input.language));
  return Promise.all([parseList(input.text, glossary), boughtByProduct(prisma, input.userId, input.storeId)]);
}

/**
 * A spoken or written list → matched store products per line, logged as a run for measuring match quality.
 * `emit` gets the parsed lines first, each line's match as it completes, then the run.
 */
export async function buildCart(
  prisma: PrismaClient,
  input: BuildInput & { source: CartBuilderSource },
  emit: (event: BuildEvent) => void,
) {
  const [parsed, bought] = await readList(prisma, input);
  emit({ type: "lines", lines: parsed.lines.map((l) => ({ text: l.text, item: l.item })) });

  const lines = await matchLines(prisma, input.storeId, parsed.lines, bought, (index, line) => emit({ type: "line", index, line }));

  const count = (confidence: CartBuilderLine["confidence"]) => lines.filter((l) => l.confidence === confidence).length;
  const run = await prisma.cartBuilderRun.create({
    data: {
      userId: input.userId,
      storeId: input.storeId,
      source: input.source,
      inputText: input.text,
      lines: parsed.lines.map((line, i) => ({ ...line, confidence: lines[i].confidence, offered: lines[i].candidates.map((c) => c.storeProduct.id) })),
      matchedCount: count("MATCHED"),
      pickCount: count("PICK"),
      notFoundCount: count("NOT_FOUND"),
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
    },
    select: { id: true },
  });
  emit({ type: "done", runId: run.id });
}

/**
 * Re-matches a line the shopper re-worded during review: same reading and matching as a whole list, without a run
 * (an edited list no longer lines up with one). A re-wording that names two things comes back as two lines.
 */
export async function matchText(prisma: PrismaClient, input: BuildInput) {
  const [parsed, bought] = await readList(prisma, input);
  return matchLines(prisma, input.storeId, parsed.lines, bought);
}
