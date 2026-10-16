import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import type { ApiResponse } from "@martly/shared/types";
import { ArtReplaceError, replaceBannerImage, replaceHeroBackground, replaceTileImage } from "../../services/seasonal/replace-art.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { ownCollection } from "./access.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// The uploaded file as a buffer sharp can decode; sends a 400 and returns undefined otherwise
async function readImage(request: FastifyRequest, reply: FastifyReply) {
  const file = await request.file();
  if (!file || !file.mimetype.startsWith("image/")) return void reply.badRequest("Upload an image file");
  const image = await file.toBuffer();
  const readable = await sharp(image).metadata().then(() => true, () => false);
  if (!readable) return void reply.badRequest("That image couldn't be read; try a PNG, JPG or WebP");
  return image;
}

async function replacing<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return { success: true, data: await work() } satisfies ApiResponse<T>;
  } catch (err) {
    if (err instanceof ArtReplaceError) return reply.badRequest(err.message);
    throw err;
  }
}

/** Hand-picked replacements for a collection's generated art, prepared exactly like the generator's output. */
export async function collectionImageRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

  app.put<{ Params: { id: string; lang: string } }>("/:id/banner-image/:lang", { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] }, async (request, reply) => {
    const collection = await ownCollection(app, request, reply);
    const image = collection && (await readImage(request, reply));
    if (!collection || !image) return;
    return replacing(reply, () => replaceBannerImage(app.prisma, collection, request.params.lang, image));
  });

  app.put<{ Params: { id: string } }>("/:id/hero/image", { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] }, async (request, reply) => {
    const collection = await ownCollection(app, request, reply);
    const image = collection && (await readImage(request, reply));
    if (!collection || !image) return;
    return replacing(reply, () => replaceHeroBackground(app.prisma, collection, image));
  });

  app.put<{ Params: { id: string; tileId: string } }>("/:id/tiles/:tileId/image", { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] }, async (request, reply) => {
    const collection = await ownCollection(app, request, reply);
    if (!collection) return;
    const tile = await app.prisma.collectionTile.findFirst({ where: { id: request.params.tileId, collectionId: collection.id }, select: { id: true } });
    if (!tile) return reply.notFound("Tile not found");
    const image = await readImage(request, reply);
    if (!image) return;
    return replacing(reply, () => replaceTileImage(app.prisma, collection.slug, tile.id, image));
  });
}
