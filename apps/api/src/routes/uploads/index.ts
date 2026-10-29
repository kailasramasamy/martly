import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { z } from "zod";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { rateLimits } from "../../middleware/rate-limit.js";
import { optimizeImage, putObject } from "../../services/media.js";
import { trimLogo } from "../../services/brand-logo.js";

// A logo is cut to its mark so a wide wordmark fills its plate instead of floating in a square
const uploadQuerySchema = z.object({ kind: z.enum(["logo"]).optional() });

// What the file really is (read from its bytes, not the type the client sent); SVG and anything else is refused
const IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  // Generous enough for a store adding a product's photos in one go
  const uploadLimit = rateLimits(app, [{ max: 60, window: "10 minutes", key: (request) => `upload:${request.user.sub}` }]);
  app.post(
    "/",
    { preHandler: [authenticate, uploadLimit] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.badRequest("No file uploaded");

      const { kind } = uploadQuerySchema.parse(request.query);
      const buffer = await file.toBuffer();
      const format = await sharp(buffer).metadata().then((m) => m.format, () => undefined);
      if (!format || !IMAGE_FORMATS.has(format)) {
        return reply.badRequest("That image couldn't be read; try a PNG, JPG or WebP");
      }
      // Every upload is re-encoded, so only images we wrote are ever served from the media domain
      const image = kind === "logo" ? await trimLogo(buffer) : await optimizeImage(buffer);
      const uploaded = await putObject(`${randomUUID()}.webp`, image, "image/webp");

      const response: ApiResponse<{ url: string; key: string }> = {
        success: true,
        data: uploaded,
      };
      return response;
    },
  );
}
