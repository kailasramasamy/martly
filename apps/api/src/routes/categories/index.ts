import type { FastifyInstance } from "fastify";
import { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, CategoryTreeNode } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

function buildTree(categories: Array<{ id: string; name: string; slug: string; parentId: string | null; sortOrder: number; imageUrl: string | null }>): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

export async function categoryRoutes(app: FastifyInstance) {
  // List categories (flat, paginated)
  app.get("/", async (request) => {
    const { page = 1, pageSize = 50, parentId } = request.query as {
      page?: number; pageSize?: number; parentId?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = {};
    if (parentId !== undefined) {
      where.parentId = parentId === "null" ? null : parentId;
    }

    const [categories, total] = await Promise.all([
      app.prisma.category.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { sortOrder: "asc" },
      }),
      app.prisma.category.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof categories)[0]> = {
      success: true,
      data: categories,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Full nested tree
  app.get("/tree", async () => {
    const categories = await app.prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const tree = buildTree(categories);
    const response: ApiResponse<CategoryTreeNode[]> = { success: true, data: tree };
    return response;
  });

  // Get single category with children
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const category = await app.prisma.category.findUnique({
      where: { id: request.params.id },
      include: { children: { orderBy: { sortOrder: "asc" } }, parent: true },
    });
    if (!category) return reply.notFound("Category not found");

    const response: ApiResponse<typeof category> = { success: true, data: category };
    return response;
  });

  // Get products in category + all descendants
  app.get<{ Params: { id: string } }>("/:id/products", async (request, reply) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const category = await app.prisma.category.findUnique({ where: { id: request.params.id } });
    if (!category) return reply.notFound("Category not found");

    // Collect this category + all descendant IDs
    const allCategories = await app.prisma.category.findMany();
    const descendantIds = new Set<string>([request.params.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cat of allCategories) {
        if (cat.parentId && descendantIds.has(cat.parentId) && !descendantIds.has(cat.id)) {
          descendantIds.add(cat.id);
          changed = true;
        }
      }
    }

    const where = { categoryId: { in: Array.from(descendantIds) } };
    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        skip,
        take: Number(pageSize),
        include: { category: true, variants: true },
        orderBy: { name: "asc" },
      }),
      app.prisma.product.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof products)[0]> = {
      success: true,
      data: products,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Create category (admin only)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createCategorySchema.parse(request.body);

      // Auto-assign sortOrder if not provided
      let sortOrder = body.sortOrder;
      if (sortOrder === undefined) {
        const maxSort = await app.prisma.category.aggregate({
          where: { parentId: body.parentId ?? null },
          _max: { sortOrder: true },
        });
        sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
      }

      const category = await app.prisma.category.create({
        data: { ...body, sortOrder },
      });

      const response: ApiResponse<typeof category> = { success: true, data: category };
      return response;
    },
  );

  // Reorder categories (admin only)
  app.post(
    "/reorder",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const { items } = reorderCategoriesSchema.parse(request.body);

      await app.prisma.$transaction(
        items.map((item) =>
          app.prisma.category.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );

  // Update category
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const body = updateCategorySchema.parse(request.body);
      const existing = await app.prisma.category.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Category not found");

      const category = await app.prisma.category.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof category> = { success: true, data: category };
      return response;
    },
  );

  // Delete category (only if no products or children)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.category.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { products: true, children: true } } },
      });
      if (!existing) return reply.notFound("Category not found");
      if (existing._count.products > 0) return reply.conflict("Category has products — remove them first");
      if (existing._count.children > 0) return reply.conflict("Category has subcategories — remove them first");

      await app.prisma.category.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
