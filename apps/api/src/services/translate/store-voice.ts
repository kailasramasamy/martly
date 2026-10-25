import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { ErrorLog } from "./product.js";

const MODEL = "claude-haiku-5-5";

const INSTRUCTIONS = `You translate a grocery shop owner's short messages to shoppers, for a shopping app used in Dharmapuri, Tamil Nadu.
Messages are about stock that came in, new products and why the owner recommends one.
- Tamil into English: plain, warm, everyday English, as the owner would say it. Keep place names (Ooty, Salem, Pennagaram).
- English into Tamil: short, natural spoken Tamil, the way a local shop owner talks, not a literal translation.
- Keep amounts, sizes and the ₹ sign exactly as written.`;

const TranslationSchema = z.object({ text: z.string().describe("The message in the target language") });

// Tamil script anywhere means the owner wrote in Tamil
const TAMIL = /[஀-௿]/;

/** "ta" when the text has Tamil script, else "en" */
export const languageOf = (text: string) => (TAMIL.test(text) ? "ta" : "en");

const otherLanguage = (language: string) => (language === "ta" ? "en" : "ta");

async function translateText(text: string, to: string) {
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 1000,
    system: INSTRUCTIONS,
    output_config: { effort: "low", format: betaZodOutputFormat(TranslationSchema) },
    messages: [{ role: "user", content: `Translate into ${to === "ta" ? "Tamil" : "English"}:\n${text}` }],
  });
  return response.stop_reason === "refusal" ? null : response.parsed_output?.text ?? null;
}

/**
 * The other language's text for an owner's words, for the form to show before posting. Null without a key, or when
 * the API refuses or fails (logged): the post is then translated after it's saved
 */
export async function previewTranslation(text: string, log: ErrorLog) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const language = languageOf(text);
  const to = otherLanguage(language);
  const translated = await translateText(text, to).catch((err: unknown) => {
    if (!(err instanceof Anthropic.APIError)) throw err;
    log.error(err, "Post translation preview failed");
    return null;
  });
  return translated ? { language, translations: { [to]: { text: translated } } } : null;
}

type Voice = { text: string; language: string; translations: Prisma.JsonValue | null };
type Save = (translations: Prisma.InputJsonValue) => Promise<unknown>;

// Fills the other language once; a translation already there (the owner's own, or an earlier run) stays
async function fill(row: Voice | null, save: Save) {
  if (!row) return;
  const to = otherLanguage(row.language);
  const all = (row.translations ?? {}) as Record<string, { text?: string }>;
  if (all[to]?.text?.trim()) return;
  const text = await translateText(row.text, to);
  if (text) await save({ ...all, [to]: { text } });
}

/** A post in the other language (Tamil ↔ English). Never rejects: a failed call leaves it as written and is logged */
export async function translateStorePost(prisma: PrismaClient, postId: string, log: ErrorLog) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const post = await prisma.storePost.findUnique({ where: { id: postId }, select: { text: true, language: true, translations: true } });
  await fill(post, (translations) => prisma.storePost.update({ where: { id: postId }, data: { translations } }))
    .catch((err: unknown) => log.error(err, `Translation failed for store post ${postId}`));
}

/** An owner's pick note in the other language, the same way */
export async function translateStorePick(prisma: PrismaClient, pickId: string, log: ErrorLog) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const pick = await prisma.storePick.findUnique({ where: { id: pickId }, select: { note: true, language: true, translations: true } });
  const row = pick && { text: pick.note, language: pick.language, translations: pick.translations };
  await fill(row, (translations) => prisma.storePick.update({ where: { id: pickId }, data: { translations } }))
    .catch((err: unknown) => log.error(err, `Translation failed for store pick ${pickId}`));
}
