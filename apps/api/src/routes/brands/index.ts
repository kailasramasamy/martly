import type { FastifyInstance } from "fastify";
import { createBrandSchema, updateBrandSchema } from "@martly/shared/schemas";
import type { ApiResponse, BrandDirectory, BrandSummary, DirectoryBrand, DirectoryDepartment, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

type Translations = DirectoryDepartment["translations"];
type DirectoryRow = DirectoryBrand & {
  deptId: string; deptName: string; deptTranslations: Translations;
  catId: string; catName: string; catTranslations: Translations;
};

// Rows arrive ordered by department, category, then brand rank: fold them into the nested directory
function buildDirectory(rows: DirectoryRow[]): BrandDirectory {
  const departments: DirectoryDepartment[] = [];
  const featured = new Map<string, DirectoryBrand>();
  for (const { deptId, deptName, deptTranslations, catId, catName, catTranslations, ...brand } of rows) {
    let dept = departments.at(-1);
    if (dept?.id !== deptId) departments.push(dept = { id: deptId, name: deptName, translations: deptTranslations, categories: [] });
    let cat = dept.categories.at(-1);
    if (cat?.id !== catId) dept.categories.push(cat = { id: catId, name: catName, translations: catTranslations, brands: [] });
    cat.brands.push(brand);
    if (brand.themeColor) {
      const seen = featured.get(brand.id);
      featured.set(brand.id, { ...brand, productCount: (seen?.productCount ?? 0) + brand.productCount });
    }
  }
  return {
    featured: [...featured.values()].sort((a, b) => b.productCount - a.productCount),
    departments,
    brandCount: new Set(rows.map((r) => r.id)).size,
  };
}

export async function brandRoutes(app: FastifyInstance) {
  // List brands
  app.get("/", async (request) => {
    const { page = 1, pageSize = 50, q } = request.query as {
      page?: number; pageSize?: number; q?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    const [brands, total] = await Promise.all([
      app.prisma.brand.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      }),
      app.prisma.brand.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof brands)[0]> = {
      success: true,
      data: brands,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // KPI counts for the admin brand list
  app.get("/summary", { preHandler: [authenticate] }, async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, brandStores, withoutLogo, withoutProducts, addedLast30d] = await Promise.all([
      app.prisma.brand.count(),
      app.prisma.brand.count({ where: { themeColor: { not: null } } }),
      app.prisma.brand.count({ where: { imageUrl: null } }),
      app.prisma.brand.count({ where: { products: { none: {} } } }),
      app.prisma.brand.count({ where: { createdAt: { gte: since } } }),
    ]);
    const response: ApiResponse<BrandSummary> = {
      success: true,
      data: { total, brandStores, withoutLogo, withoutProducts, addedLast30d },
    };
    return response;
  });

  // Brands with active listings in a store: brands with a brand store (theme colour) first, then most products — powers "Shop by brand"
  app.get<{ Params: { storeId: string } }>("/store/:storeId", async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.storeId }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const limit = Math.min(Math.max(Number((request.query as { limit?: string }).limit) || 50, 1), 200);

    const brands = await app.prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null; themeColor: string | null; productCount: number }[]>`
      SELECT b.id, b.name, b.image_url AS "imageUrl", b.theme_color AS "themeColor", COUNT(DISTINCT p.id)::int AS "productCount"
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN brands b ON b.id = p.brand_id
      WHERE sp.store_id = ${store.id} AND sp.is_active = true AND p.is_active = true
      GROUP BY b.id
      ORDER BY (b.theme_color IS NOT NULL) DESC, "productCount" DESC, b.name ASC
      LIMIT ${limit}`;

    const response: ApiResponse<typeof brands> = { success: true, data: brands };
    return response;
  });

  // A store's brands by department → category, for the "All brands" screen
  app.get<{ Params: { storeId: string } }>("/store/:storeId/directory", async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.storeId }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    const rows = await app.prisma.$queryRaw<DirectoryRow[]>`
      SELECT d.id AS "deptId", d.name AS "deptName", d.translations AS "deptTranslations",
        c.id AS "catId", c.name AS "catName", c.translations AS "catTranslations",
        b.id, b.name, b.image_url AS "imageUrl", b.theme_color AS "themeColor",
        b.theme_color_secondary AS "themeColorSecondary", COUNT(DISTINCT p.id)::int AS "productCount"
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN brands b ON b.id = p.brand_id
      JOIN subcategories s ON s.id = p.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN departments d ON d.id = c.department_id
      WHERE sp.store_id = ${store.id} AND sp.is_active = true AND p.is_active = true
      GROUP BY d.id, c.id, b.id
      ORDER BY d.sort_order, d.name, c.sort_order, c.name,
        (b.theme_color IS NOT NULL) DESC, "productCount" DESC, b.name`;

    const response: ApiResponse<BrandDirectory> = { success: true, data: buildDirectory(rows) };
    return response;
  });

  // Get brand by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const brand = await app.prisma.brand.findUnique({
      where: { id: request.params.id },
    });
    if (!brand) return reply.notFound("Brand not found");

    const response: ApiResponse<typeof brand> = { success: true, data: brand };
    return response;
  });

  // Create brand
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request) => {
      const body = createBrandSchema.parse(request.body);

      const brand = await app.prisma.brand.create({ data: body });

      const response: ApiResponse<typeof brand> = { success: true, data: brand };
      return response;
    },
  );

  // Update brand
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request, reply) => {
      const body = updateBrandSchema.parse(request.body);
      const existing = await app.prisma.brand.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Brand not found");

      const brand = await app.prisma.brand.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof brand> = { success: true, data: brand };
      return response;
    },
  );

  // Delete brand (only if no products reference it)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.brand.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { products: true } } },
      });
      if (!existing) return reply.notFound("Brand not found");
      if (existing._count.products > 0) return reply.conflict("Brand has products — remove them first");

      await app.prisma.brand.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
