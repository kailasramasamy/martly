import type { FastifyInstance } from "fastify";
import { createCollectionSchema, updateCollectionSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

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
            product: { include: { brand: true, category: true } },
          },
        },
        organization: { select: { id: true, name: true } },
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

      const response: ApiResponse<typeof collection> = { success: true, data: collection };
      return response;
    },
  );

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

      await app.prisma.collection.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
