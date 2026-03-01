import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? "media-image-upload";
const KEY_PREFIX = process.env.S3_KEY_PREFIX ?? "martly";
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL ?? `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com/${KEY_PREFIX}`;

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
      const filename = `${randomUUID()}${ext}`;
      const key = `${KEY_PREFIX}/${filename}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
        }),
      );

      const url = `${BASE_URL}/${filename}`;

      const response: ApiResponse<{ url: string; key: string }> = {
        success: true,
        data: { url, key },
      };
      return response;
    },
  );
}
