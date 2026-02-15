import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { v2 as cloudinary } from "cloudinary";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.badRequest("No file uploaded");

      const buffer = await file.toBuffer();

      const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "martly" },
            (error, result) => {
              if (error || !result) return reject(error ?? new Error("Upload failed"));
              resolve(result);
            },
          );
          stream.end(buffer);
        },
      );

      const response: ApiResponse<{ url: string; publicId: string }> = {
        success: true,
        data: { url: result.secure_url, publicId: result.public_id },
      };
      return response;
    },
  );
}
