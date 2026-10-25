import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { speechTranscribeSchema } from "@martly/shared/schemas";
import type { ApiResponse, SpeechTranscript } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { createRateLimiter } from "../../services/rate-limit.js";
import { SpeechLanguageError, SpeechProviderError, SpeechUnavailableError, transcribe, transcribePost } from "../../services/speech/index.js";

// One call per spoken item, so a long list stays well inside this
const checkRateLimit = createRateLimiter(30, 60_000);
const AUDIO_TYPES = new Set(["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave"]);

export async function speechRoutes(app: FastifyInstance) {
  // A 15 s AAC clip is about 150 KB
  await app.register(multipart, { limits: { fileSize: 1024 * 1024, files: 1 } });

  // One spoken shopping-list item, or one sentence of an owner's post (a short clip cut at the pause) → its text
  app.post("/transcribe", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const file = await request.file();
    if (!file) return reply.badRequest("No audio uploaded");
    const fields = Object.fromEntries(
      Object.entries(file.fields).flatMap(([k, f]) => (f && !Array.isArray(f) && f.type === "field" ? [[k, f.value]] : [])),
    );
    const parsed = speechTranscribeSchema.safeParse(fields);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    if (!AUDIO_TYPES.has(file.mimetype)) return reply.badRequest("Unsupported audio type");
    if (!checkRateLimit(user.sub)) return reply.tooManyRequests("Too many voice items. Please wait a moment.");

    const audio = await file.toBuffer();
    if (audio.length === 0) return reply.badRequest("The recording is empty");
    const store = await app.prisma.store.findFirst({ where: { id: parsed.data.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    const started = Date.now();
    try {
      const heard = parsed.data.purpose === "post"
        ? await transcribePost(audio, file.mimetype)
        : await transcribe(app.prisma, { audio, mime: file.mimetype, storeId: store.id, appLanguage: parsed.data.language });
      request.log.info({ bytes: audio.length, ms: Date.now() - started, language: heard.language, keyterms: heard.keyterms, chars: heard.text.length }, "speech transcribed");
      return { success: true, data: { text: heard.text } } satisfies ApiResponse<SpeechTranscript>;
    } catch (err) {
      if (err instanceof SpeechUnavailableError) return reply.serviceUnavailable("Voice is not available");
      if (err instanceof SpeechLanguageError) return reply.badRequest("Speak in English or Tamil");
      if (err instanceof SpeechProviderError) {
        request.log.warn({ err: err.message, ms: Date.now() - started }, "speech provider failed");
        return reply.badGateway("We couldn't hear that. Please try again.");
      }
      throw err;
    }
  });
}
