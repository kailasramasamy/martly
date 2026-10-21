const ENDPOINT = "https://api.sarvam.ai/speech-to-text";
const TIMEOUT_MS = 10_000;

/** The speech provider failed or could not be reached */
export class SpeechProviderError extends Error {}

/**
 * One clip through Sarvam's saaras:v4. `language` is a BCP-47 code such as "ta-IN", or "unknown" to let it detect;
 * `keyterms` (up to 50) are words it should expect, such as the staples shoppers name. `roman` writes the words in
 * English letters ("Rin soppu ondru") instead of the language's own script.
 */
export async function sarvamTranscribe(audio: Buffer, mime: string, language: string, keyterms: string[], roman: boolean) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new SpeechProviderError("SARVAM_API_KEY is not set");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), "clip");
  form.append("model", "saaras:v4");
  form.append("language_code", language);
  if (roman) form.append("mode", "translit");
  if (keyterms.length > 0) form.append("keyterms", JSON.stringify(keyterms));

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err: Error) => {
    throw new SpeechProviderError(`Sarvam unreachable: ${err.message}`);
  });
  if (!res.ok) throw new SpeechProviderError(`Sarvam ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { transcript?: string };
  return body.transcript ?? "";
}
