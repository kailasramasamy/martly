import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { isOptimizableImage, optimizeImage, putObject } from "../../services/media.js";

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.post(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.badRequest("No file uploaded");

      const buffer = await file.toBuffer();
      const optimize = isOptimizableImage(file.mimetype);
      if (optimize && !(await sharp(buffer).metadata().then(() => true, () => false))) {
        return reply.badRequest("That image couldn't be read; try a PNG, JPG or WebP");
      }
      const uploaded = optimize
        ? await putObject(`${randomUUID()}.webp`, await optimizeImage(buffer), "image/webp")
        : await putObject(`${randomUUID()}${path.extname(file.filename) || ".jpg"}`, buffer, file.mimetype);

      const response: ApiResponse<{ url: string; key: string }> = {
        success: true,
        data: uploaded,
      };
      return response;
    },
  );
}
