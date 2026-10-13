import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import path from "path";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { putObject } from "../../services/media.js";

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "CUSTOMER")] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.badRequest("No file uploaded");

      const buffer = await file.toBuffer();
      const ext = path.extname(file.filename) || ".jpg";
      const uploaded = await putObject(`${randomUUID()}${ext}`, buffer, file.mimetype);

      const response: ApiResponse<{ url: string; key: string }> = {
        success: true,
        data: uploaded,
      };
      return response;
    },
  );
}
