import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  createCollectionSchema, updateCollectionHeroSchema, updateCollectionSchema, updateCollectionTileSchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isCurationConfigured, regenerateBanner, regenerateHero } from "../../services/seasonal/index.js";
import { saveHero, withHeroTranslation } from "../../services/seasonal/hero.js";

const ADMINS = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")];

// ORG_ADMIN may only touch its own org's collections; sends the error reply and returns undefined otherwise
async function ownCollection(app: FastifyInstance, request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const collection = await app.prisma.collection.findUnique({
    where: { id: request.params.id },
    include: { festivalEvent: { select: { name: true, guidance: true } } },
  });
  if (!collection) return void reply.notFound("Collection not found");
  const user = getOrgUser(request);
  if (user.role === "ORG_ADMIN" && collection.organizationId !== user.organizationId) return void reply.forbidden("Access denied");
  return collection;
}

export async function collectionRoutes(app: FastifyInstance) {
  // List collections
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { page = 1, pageSize = 50, q } = request.query as {
      page?: number; pageSize?: number; q?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};

    // Org-scoped: non-SUPER_ADMIN sees own org + global
    if (user.role !== "SUPER_ADMIN") {
      where.OR = [
        { organizationId: user.organizationId },
        { organizationId: null },
      ];
    }

    if (q) {
      where.title = { contains: q, mode: "insensitive" };
    }

    const [collections, total] = await Promise.all([
      app.prisma.collection.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { items: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      app.prisma.collection.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof collections)[0]> = {
      success: true,
      data: collections,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get collection by ID
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const collection = await app.prisma.collection.findUnique({
      where: { id: request.params.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: { include: { brand: true, subcategory: true } },
          },
        },
        organization: { select: { id: true, name: true } },
        tiles: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!collection) return reply.notFound("Collection not found");

    const response: ApiResponse<typeof collection> = { success: true, data: collection };
    return response;
  });

  // Create collection
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const { productIds, ...body } = createCollectionSchema.parse(request.body);
      const user = getOrgUser(request);

      // ORG_ADMIN: force their org
      if (user.role === "ORG_ADMIN") {
        body.organizationId = user.organizationId;
      }

      // Auto sortOrder if not provided
      if (body.sortOrder === undefined) {
        const last = await app.prisma.collection.findFirst({
          where: { organizationId: body.organizationId ?? null },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        body.sortOrder = (last?.sortOrder ?? 0) + 1;
      }

      const collection = await app.prisma.collection.create({
        data: {
          ...body,
          items: productIds?.length
            ? { create: productIds.map((productId, idx) => ({ productId, sortOrder: idx })) }
            : undefined,
        },
        include: {
          _count: { select: { items: true } },
          items: { include: { product: true } },
        },
      });

      const response: ApiResponse<typeof collection> = { success: true, data: collection };
      return response;
    },
  );

  // Update collection
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { productIds, ...body } = updateCollectionSchema.parse(request.body);
      const existing = await app.prisma.collection.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Collection not found");

      // ORG_ADMIN can only edit own org's collections
      const user = getOrgUser(request);
      if (user.role === "ORG_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }

      // If productIds sent, replace all items
      if (productIds) {
        await app.prisma.collectionItem.deleteMany({ where: { collectionId: existing.id } });
        if (productIds.length > 0) {
          await app.prisma.collectionItem.createMany({
            data: productIds.map((productId, idx) => ({
              collectionId: existing.id,
              productId,
              sortOrder: idx,
            })),
          });
        }
      }

      const collection = await app.prisma.collection.update({
        where: { id: request.params.id },
        data: body,
        include: {
          _count: { select: { items: true } },
          items: { include: { product: true } },
        },
      });

      // Agent collections own a hero banner; keep it in step so deactivating the collection vetoes both
      if (existing.source === "AGENT") {
        const { isActive, startsAt, endsAt } = body;
        await app.prisma.banner.updateMany({
          where: { actionType: "COLLECTION", actionTarget: existing.id },
          data: { isActive, startsAt, endsAt },
        });
      }

      const response: ApiResponse<typeof collection> = { success: true, data: collection };
      return response;
    },
  );

  // Redraw the AI banner from the collection's current title and subtitle
  app.post<{ Params: { id: string } }>(
    "/:id/regenerate-banner",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      if (!isCurationConfigured()) return reply.serviceUnavailable("Banner generation needs ANTHROPIC_API_KEY and OPENAI_API_KEY");
      const existing = await app.prisma.collection.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Collection not found");
      const user = getOrgUser(request);
      if (user.role === "ORG_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }
      if (!existing.artDirection) return reply.badRequest("Only AI-curated collections can regenerate their banner");

      const art = await regenerateBanner(app.prisma, { ...existing, artDirection: existing.artDirection }, (msg) => request.log.warn(`${existing.slug}: ${msg}`));
      const response: ApiResponse<typeof art> = { success: true, data: art };
      return response;
    },
  );

  // Design and paint the festive home hero (background and tiles) from scratch
  app.post<{ Params: { id: string } }>("/:id/regenerate-hero", { preHandler: ADMINS }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("Hero generation needs ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const collection = await ownCollection(app, request, reply);
    if (!collection) return;
    if (!collection.organizationId) return reply.badRequest("Only organization collections can have a festive hero");
    const hero = await regenerateHero(app.prisma, { ...collection, organizationId: collection.organizationId });
    if (!hero) return reply.unprocessableEntity("The catalog can't fill a row of festive tiles for this collection");
    return { success: true, data: hero } satisfies ApiResponse<typeof hero>;
  });

  app.put<{ Params: { id: string } }>("/:id/hero", { preHandler: ADMINS }, async (request, reply) => {
    const { heroTitle, heroTitleTa } = updateCollectionHeroSchema.parse(request.body);
    const collection = await ownCollection(app, request, reply);
    if (!collection) return;
    if (!collection.heroImageUrl) return reply.badRequest("This collection has no festive hero");
    const updated = await app.prisma.collection.update({
      where: { id: collection.id },
      data: { heroTitle, translations: withHeroTranslation(collection.translations, heroTitleTa ?? null) },
      select: { id: true, heroTitle: true, translations: true },
    });
    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });

  // Removes the hero so the home screen falls back to its banner carousel
  app.delete<{ Params: { id: string } }>("/:id/hero", { preHandler: ADMINS }, async (request, reply) => {
    const collection = await ownCollection(app, request, reply);
    if (!collection) return;
    await saveHero(app.prisma, collection, null);
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  app.put<{ Params: { id: string; tileId: string } }>("/:id/tiles/:tileId", { preHandler: ADMINS }, async (request, reply) => {
    const { title, titleTa, subcategoryIds } = updateCollectionTileSchema.parse(request.body);
    const collection = await ownCollection(app, request, reply);
    if (!collection) return;
    const tile = await app.prisma.collectionTile.findFirst({ where: { id: request.params.tileId, collectionId: collection.id } });
    if (!tile) return reply.notFound("Tile not found");
    if (subcategoryIds && (await app.prisma.subcategory.count({ where: { id: { in: subcategoryIds } } })) !== subcategoryIds.length) {
      return reply.badRequest("Unknown subcategory");
    }
    const translations = titleTa === undefined ? undefined : titleTa ? { ta: { title: titleTa } } : Prisma.DbNull;
    const updated = await app.prisma.collectionTile.update({ where: { id: tile.id }, data: { title, subcategoryIds, translations } });
    return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
  });

  // Delete collection
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.collection.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Collection not found");

      const user = getOrgUser(request);
      if (user.role === "ORG_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }

      await app.prisma.$transaction([
        app.prisma.banner.deleteMany({ where: { actionType: "COLLECTION", actionTarget: existing.id } }),
        app.prisma.collection.delete({ where: { id: existing.id } }),
      ]);

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
