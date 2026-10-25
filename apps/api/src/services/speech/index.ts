import { GLOSSARY_LANGUAGES, type GlossaryLanguage } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { glossaryKeyterms, storeLanguages } from "../cart-builder/glossary.js";
import { sarvamTranscribe } from "./sarvam.js";

export { SpeechProviderError } from "./sarvam.js";

/** No speech provider is configured, so the app uses the phone's own recogniser */
export class SpeechUnavailableError extends Error {}

export interface TranscribeInput {
  audio: Buffer;
  mime: string;
  storeId: string;
  appLanguage?: string;
}

/**
 * One spoken list item → text. The store's region language (else the shopper's app language) picks the recogniser
 * language and the glossary words it listens for; with neither, the provider detects the language. A shopper whose
 * app is in English can still speak Tamil: their words come back in English letters, the way they'd type them.
 */
export async function transcribe(prisma: PrismaClient, { audio, mime, storeId, appLanguage }: TranscribeInput) {
  if (process.env.SPEECH_PROVIDER !== "sarvam") throw new SpeechUnavailableError("No speech provider");
  const appGlossary = appLanguage && appLanguage in GLOSSARY_LANGUAGES ? (appLanguage as GlossaryLanguage) : undefined;
  const language = (await storeLanguages(prisma, storeId))?.[0] ?? appGlossary;
  const keyterms = language ? await glossaryKeyterms(prisma, language) : [];
  const { transcript: text } = await sarvamTranscribe(audio, mime, language ? `${language}-IN` : "unknown", keyterms, appLanguage === "en");
  // Sarvam ends each clip with a full stop; a list line has none
  return { text: text.trim().replace(/[.।]+$/, "").trim(), language: language ?? "unknown", keyterms: keyterms.length };
}

// Owner posts are spoken in English or Tamil for now; other languages come with their translations
const POST_LANGUAGES = new Set(["en-IN", "ta-IN"]);

/** Something else was spoken than a post can take */
export class SpeechLanguageError extends Error {}

/**
 * One sentence of an owner's post → text, written as spoken: Sarvam detects English or Tamil, Tamil stays in Tamil
 * script (so the post is translated the right way) and the sentence keeps its full stop
 */
export async function transcribePost(audio: Buffer, mime: string) {
  if (process.env.SPEECH_PROVIDER !== "sarvam") throw new SpeechUnavailableError("No speech provider");
  const heard = await sarvamTranscribe(audio, mime, "unknown", [], false);
  // "unknown" back means Sarvam didn't say which; the words are taken as they are
  if (heard.language !== "unknown" && !POST_LANGUAGES.has(heard.language)) throw new SpeechLanguageError(`Heard ${heard.language}`);
  return { text: heard.transcript.trim(), language: heard.language, keyterms: 0 };
}
