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
  const text = await sarvamTranscribe(audio, mime, language ? `${language}-IN` : "unknown", keyterms, appLanguage === "en");
  // Sarvam ends each clip with a full stop; a list line has none
  return { text: text.trim().replace(/[.।]+$/, "").trim(), language: language ?? "unknown", keyterms: keyterms.length };
}
