import type { FastifyInstance } from "fastify";
import {
  createDepartmentSchema, updateDepartmentSchema,
  createCategorySchema, updateCategorySchema,
  createSubcategorySchema, updateSubcategorySchema,
  reorderItemsSchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, DepartmentNode, CategoryNode, SubcategoryNode } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { formatVariantUnits } from "../../services/units.js";

export async function categoryRoutes(app: FastifyInstance) {

  // ── Tree ────────────────────────────────────────────
  app.get("/tree", async () => {
    const [departments, categories, subcategories] = await Promise.all([
      app.prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
      app.prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      app.prisma.subcategory.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

    const subcatsByCatId = new Map<string, SubcategoryNode[]>();
    for (const sc of subcategories) {
      const list = subcatsByCatId.get(sc.categoryId) ?? [];
      list.push({ id: sc.id, name: sc.name, slug: sc.slug, sortOrder: sc.sortOrder, imageUrl: sc.imageUrl, translations: sc.translations as SubcategoryNode["translations"] });
      subcatsByCatId.set(sc.categoryId, list);
    }

    const catsByDeptId = new Map<string, CategoryNode[]>();
    for (const cat of categories) {
      const list = catsByDeptId.get(cat.departmentId) ?? [];
      list.push({ id: cat.id, name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, imageUrl: cat.imageUrl, translations: cat.translations as CategoryNode["translations"], subcategories: subcatsByCatId.get(cat.id) ?? [] });
      catsByDeptId.set(cat.departmentId, list);
    }

    const tree: DepartmentNode[] = departments.map((d) => ({
      id: d.id, name: d.name, slug: d.slug, sortOrder: d.sortOrder, imageUrl: d.imageUrl,
      translations: d.translations as DepartmentNode["translations"],
      categories: catsByDeptId.get(d.id) ?? [],
    }));

    return { success: true, data: tree } satisfies ApiResponse<DepartmentNode[]>;
  });

  // ── Departments CRUD ────────────────────────────────
  app.get("/departments", async (request) => {
    const { page = 1, pageSize = 50 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [data, total] = await Promise.all([
      app.prisma.department.findMany({ skip, take: Number(pageSize), orderBy: { sortOrder: "asc" } }),
      app.prisma.department.count(),
    ]);
    return { success: true, data, meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) } } satisfies PaginatedResponse<(typeof data)[0]>;
  });

  app.get<{ Params: { id: string } }>("/departments/:id", async (request, reply) => {
    const dept = await app.prisma.department.findUnique({ where: { id: request.params.id }, include: { categories: { orderBy: { sortOrder: "asc" } } } });
    if (!dept) return reply.notFound("Department not found");
    return { success: true, data: dept } satisfies ApiResponse<typeof dept>;
  });

  app.post("/departments", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request) => {
    const body = createDepartmentSchema.parse(request.body);
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined) {
      const max = await app.prisma.department.aggregate({ _max: { sortOrder: true } });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }
    const dept = await app.prisma.department.create({ data: { ...body, sortOrder } });
    return { success: true, data: dept } satisfies ApiResponse<typeof dept>;
  });

  app.put<{ Params: { id: string } }>("/departments/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const body = updateDepartmentSchema.parse(request.body);
    const existing = await app.prisma.department.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Department not found");
    const dept = await app.prisma.department.update({ where: { id: request.params.id }, data: body });
    return { success: true, data: dept } satisfies ApiResponse<typeof dept>;
  });

  app.delete<{ Params: { id: string } }>("/departments/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const existing = await app.prisma.department.findUnique({ where: { id: request.params.id }, include: { _count: { select: { categories: true } } } });
    if (!existing) return reply.notFound("Department not found");
    if (existing._count.categories > 0) return reply.conflict("Department has categories — remove them first");
    await app.prisma.department.delete({ where: { id: request.params.id } });
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  // ── Categories CRUD ─────────────────────────────────
  app.get("/", async (request) => {
    const { page = 1, pageSize = 200, departmentId } = request.query as { page?: number; pageSize?: number; departmentId?: string };
    const skip = (Number(page) - 1) * Number(pageSize);
    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;
    const [data, total] = await Promise.all([
      app.prisma.category.findMany({ where, skip, take: Number(pageSize), orderBy: { sortOrder: "asc" }, include: { department: true } }),
      app.prisma.category.count({ where }),
    ]);
    return { success: true, data, meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) } } satisfies PaginatedResponse<(typeof data)[0]>;
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const cat = await app.prisma.category.findUnique({ where: { id: request.params.id }, include: { department: true, subcategories: { orderBy: { sortOrder: "asc" } } } });
    if (!cat) return reply.notFound("Category not found");
    return { success: true, data: cat } satisfies ApiResponse<typeof cat>;
  });

  app.post("/", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request) => {
    const body = createCategorySchema.parse(request.body);
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined) {
      const max = await app.prisma.category.aggregate({ where: { departmentId: body.departmentId }, _max: { sortOrder: true } });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }
    const cat = await app.prisma.category.create({ data: { ...body, sortOrder } });
    return { success: true, data: cat } satisfies ApiResponse<typeof cat>;
  });

  app.put<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const body = updateCategorySchema.parse(request.body);
    const existing = await app.prisma.category.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Category not found");
    const cat = await app.prisma.category.update({ where: { id: request.params.id }, data: body });
    return { success: true, data: cat } satisfies ApiResponse<typeof cat>;
  });

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const existing = await app.prisma.category.findUnique({ where: { id: request.params.id }, include: { _count: { select: { subcategories: true } } } });
    if (!existing) return reply.notFound("Category not found");
    if (existing._count.subcategories > 0) return reply.conflict("Category has subcategories — remove them first");
    await app.prisma.category.delete({ where: { id: request.params.id } });
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  // ── Subcategories CRUD ──────────────────────────────
  app.get("/subcategories", async (request) => {
    const { page = 1, pageSize = 500, categoryId } = request.query as { page?: number; pageSize?: number; categoryId?: string };
    const skip = (Number(page) - 1) * Number(pageSize);
    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    const [data, total] = await Promise.all([
      app.prisma.subcategory.findMany({ where, skip, take: Number(pageSize), orderBy: { sortOrder: "asc" }, include: { category: { include: { department: true } } } }),
      app.prisma.subcategory.count({ where }),
    ]);
    return { success: true, data, meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) } } satisfies PaginatedResponse<(typeof data)[0]>;
  });

  app.get<{ Params: { id: string } }>("/subcategories/:id", async (request, reply) => {
    const sub = await app.prisma.subcategory.findUnique({ where: { id: request.params.id }, include: { category: { include: { department: true } } } });
    if (!sub) return reply.notFound("Subcategory not found");
    return { success: true, data: sub } satisfies ApiResponse<typeof sub>;
  });

  app.post("/subcategories", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request) => {
    const body = createSubcategorySchema.parse(request.body);
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined) {
      const max = await app.prisma.subcategory.aggregate({ where: { categoryId: body.categoryId }, _max: { sortOrder: true } });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }
    const sub = await app.prisma.subcategory.create({ data: { ...body, sortOrder } });
    return { success: true, data: sub } satisfies ApiResponse<typeof sub>;
  });

  app.put<{ Params: { id: string } }>("/subcategories/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const body = updateSubcategorySchema.parse(request.body);
    const existing = await app.prisma.subcategory.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Subcategory not found");
    const sub = await app.prisma.subcategory.update({ where: { id: request.params.id }, data: body });
    return { success: true, data: sub } satisfies ApiResponse<typeof sub>;
  });

  app.delete<{ Params: { id: string } }>("/subcategories/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const existing = await app.prisma.subcategory.findUnique({ where: { id: request.params.id }, include: { _count: { select: { products: true } } } });
    if (!existing) return reply.notFound("Subcategory not found");
    if (existing._count.products > 0) return reply.conflict("Subcategory has products — remove them first");
    await app.prisma.subcategory.delete({ where: { id: request.params.id } });
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  // ── Reorder (generic) ──────────────────────────────
  app.post("/reorder", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request) => {
    const { items } = reorderItemsSchema.parse(request.body);
    const { level } = request.query as { level?: string };

    const model = level === "department" ? app.prisma.department
      : level === "subcategory" ? app.prisma.subcategory
      : app.prisma.category;

    await app.prisma.$transaction(
      items.map((item) => (model as any).update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
    );
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  // ── Products by taxonomy ID ─────────────────────────
  // Detects which level the ID belongs to and expands to subcategory IDs
  app.get<{ Params: { id: string } }>("/:id/products", async (request, reply) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);
    const { id } = request.params;

    // Detect level
    let subcategoryIds: string[] = [];

    const dept = await app.prisma.department.findUnique({ where: { id } });
    if (dept) {
      const cats = await app.prisma.category.findMany({ where: { departmentId: id }, select: { id: true } });
      const catIds = cats.map((c) => c.id);
      if (catIds.length > 0) {
        const subs = await app.prisma.subcategory.findMany({ where: { categoryId: { in: catIds } }, select: { id: true } });
        subcategoryIds = subs.map((s) => s.id);
      }
    } else {
      const cat = await app.prisma.category.findUnique({ where: { id } });
      if (cat) {
        const subs = await app.prisma.subcategory.findMany({ where: { categoryId: id }, select: { id: true } });
        subcategoryIds = subs.map((s) => s.id);
      } else {
        const sub = await app.prisma.subcategory.findUnique({ where: { id } });
        if (sub) {
          subcategoryIds = [id];
        } else {
          return reply.notFound("Department, category, or subcategory not found");
        }
      }
    }

    if (subcategoryIds.length === 0) {
      return { success: true, data: [], meta: { total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 } } satisfies PaginatedResponse<never>;
    }

    const where = { subcategoryId: { in: subcategoryIds } };
    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        skip,
        take: Number(pageSize),
        include: { subcategory: true, variants: true },
        orderBy: { name: "asc" },
      }),
      app.prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products.map((p) => ({ ...p, variants: formatVariantUnits(p.variants) })),
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    } satisfies PaginatedResponse<(typeof products)[0]>;
  });
}
