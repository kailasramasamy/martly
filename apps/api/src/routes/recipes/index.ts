import type { FastifyInstance } from "fastify";
import { createRecipeSchema, updateRecipeSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";

function enrichStoreProduct(sp: any) {
  const pricing = calculateEffectivePrice(
    sp.price as unknown as number,
    sp.variant as Parameters<typeof calculateEffectivePrice>[1],
    sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
  );
  const variant = formatVariantUnit(sp.variant);
  return { ...sp, variant, pricing, availableStock: sp.stock - sp.reservedStock };
}

export async function recipeRoutes(app: FastifyInstance) {
  // ── Admin CRUD ────────────────────────────────────

  // List recipes
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { page = 1, pageSize = 50, q } = request.query as {
      page?: number; pageSize?: number; q?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};

    if (user.role !== "SUPER_ADMIN") {
      where.OR = [
        { organizationId: user.organizationId },
        { organizationId: null },
      ];
    }

    if (q) {
      where.title = { contains: q, mode: "insensitive" };
    }

    const [recipes, total] = await Promise.all([
      app.prisma.recipe.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { items: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      app.prisma.recipe.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof recipes)[0]> = {
      success: true,
      data: recipes,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get recipe by ID
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const recipe = await app.prisma.recipe.findUnique({
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
    if (!recipe) return reply.notFound("Recipe not found");

    const response: ApiResponse<typeof recipe> = { success: true, data: recipe };
    return response;
  });

  // Create recipe
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const { items, ...body } = createRecipeSchema.parse(request.body);
      const user = getOrgUser(request);

      if (user.role === "ORG_ADMIN") {
        body.organizationId = user.organizationId;
      }

      const last = await app.prisma.recipe.findFirst({
        where: { organizationId: body.organizationId ?? null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const sortOrder = (last?.sortOrder ?? 0) + 1;

      const recipe = await app.prisma.recipe.create({
        data: {
          ...body,
          sortOrder,
          instructions: body.instructions ?? [],
          items: items?.length
            ? { create: items.map((item, idx) => ({ ...item, sortOrder: idx })) }
            : undefined,
        },
        include: {
          _count: { select: { items: true } },
          items: { include: { product: true } },
        },
      });

      const response: ApiResponse<typeof recipe> = { success: true, data: recipe };
      return response;
    },
  );

  // Update recipe
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { items, ...body } = updateRecipeSchema.parse(request.body);
      const existing = await app.prisma.recipe.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Recipe not found");

      const user = getOrgUser(request);
      if (user.role === "ORG_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }

      // Replace items if sent
      if (items) {
        await app.prisma.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        if (items.length > 0) {
          await app.prisma.recipeItem.createMany({
            data: items.map((item, idx) => ({
              recipeId: existing.id,
              ...item,
              sortOrder: idx,
            })),
          });
        }
      }

      const recipe = await app.prisma.recipe.update({
        where: { id: request.params.id },
        data: {
          ...body,
          instructions: body.instructions ?? undefined,
        },
        include: {
          _count: { select: { items: true } },
          items: { include: { product: true } },
        },
      });

      const response: ApiResponse<typeof recipe> = { success: true, data: recipe };
      return response;
    },
  );

  // Delete recipe
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.recipe.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Recipe not found");

      const user = getOrgUser(request);
      if (user.role === "ORG_ADMIN" && existing.organizationId !== user.organizationId) {
        return reply.forbidden("Access denied");
      }

      await app.prisma.recipe.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );

  // ── Store-Facing Endpoints ─────────────────────────

  // List recipes for a store (with availability summary)
  app.get<{ Params: { storeId: string } }>(
    "/stores/:storeId",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { storeId } = request.params;
      const { page = 1, pageSize = 20, q, difficulty, cuisineType, dietType } = request.query as {
        page?: number; pageSize?: number; q?: string; difficulty?: string; cuisineType?: string; dietType?: string;
      };

      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const where: Record<string, unknown> = {
        isActive: true,
        OR: [
          { organizationId: store.organizationId },
          { organizationId: null },
        ],
      };
      if (q) where.title = { contains: q, mode: "insensitive" };
      if (difficulty) where.difficulty = difficulty;
      if (cuisineType) where.cuisineType = { equals: cuisineType, mode: "insensitive" };
      if (dietType) where.dietType = dietType;

      const skip = (Number(page) - 1) * Number(pageSize);

      const [recipes, total] = await Promise.all([
        app.prisma.recipe.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: {
                  include: {
                    storeProducts: {
                      where: { storeId, isActive: true },
                      include: { variant: true },
                      orderBy: { price: "asc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        }),
        app.prisma.recipe.count({ where }),
      ]);

      const data = recipes.map((recipe) => {
        let availableCount = 0;
        let estimatedTotal = 0;

        for (const item of recipe.items) {
          const sp = item.product.storeProducts[0];
          if (sp) {
            availableCount++;
            estimatedTotal += Number(sp.price);
          }
        }

        return {
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
          imageUrl: recipe.imageUrl,
          difficulty: recipe.difficulty,
          cuisineType: recipe.cuisineType,
          dietType: recipe.dietType,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          translations: recipe.translations,
          ingredientCount: recipe.items.length,
          availableCount,
          estimatedTotal: Math.round(estimatedTotal * 100) / 100,
        };
      });

      const response: PaginatedResponse<(typeof data)[0]> = {
        success: true,
        data,
        meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
      };
      return response;
    },
  );

  // Get recipe detail for a store (with enriched ingredients)
  app.get<{ Params: { storeId: string; id: string } }>(
    "/stores/:storeId/:id",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { storeId, id } = request.params;

      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const recipe = await app.prisma.recipe.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                include: {
                  storeProducts: {
                    where: { storeId, isActive: true },
                    include: { variant: true },
                    orderBy: { price: "asc" },
                  },
                  brand: true,
                  category: true,
                },
              },
            },
          },
        },
      });
      if (!recipe) return reply.notFound("Recipe not found");

      const items = recipe.items.map((item) => {
        const cheapestSp = item.product.storeProducts[0];
        const available = !!cheapestSp;

        return {
          id: item.id,
          displayQty: item.displayQty,
          note: item.note,
          product: {
            id: item.product.id,
            name: item.product.name,
            imageUrl: item.product.imageUrl,
            foodType: item.product.foodType,
          },
          storeProduct: cheapestSp ? enrichStoreProduct(cheapestSp) : null,
          available,
        };
      });

      const response: ApiResponse<{
        id: string;
        title: string;
        slug: string;
        description: string | null;
        imageUrl: string | null;
        instructions: unknown;
        prepTime: number | null;
        cookTime: number | null;
        servings: number | null;
        difficulty: string | null;
        cuisineType: string | null;
        dietType: string | null;
        translations: unknown;
        items: typeof items;
      }> = {
        success: true,
        data: {
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          cuisineType: recipe.cuisineType,
          dietType: recipe.dietType,
          translations: recipe.translations,
          items,
        },
      };
      return response;
    },
  );
}
