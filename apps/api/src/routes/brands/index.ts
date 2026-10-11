import type { FastifyInstance } from "fastify";
import { createBrandSchema, updateBrandSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

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

  // Brands with active listings in a store, most products first — powers "Shop by brand"
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
      ORDER BY "productCount" DESC, b.name ASC
      LIMIT ${limit}`;

    const response: ApiResponse<typeof brands> = { success: true, data: brands };
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
