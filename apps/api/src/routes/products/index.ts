import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createProductSchema, updateProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function productRoutes(app: FastifyInstance) {
  // List products
  app.get("/", async (request) => {
    const { page = 1, pageSize = 20, q, categoryId, brand, foodType, productType } = request.query as {
      page?: number; pageSize?: number; q?: string; categoryId?: string; brand?: string; foodType?: string; productType?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (brand) {
      where.brand = { contains: brand, mode: "insensitive" };
    }
    if (foodType) {
      where.foodType = foodType;
    }
    if (productType) {
      where.productType = productType;
    }

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: { category: true, variants: true },
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

  // Get product by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const product = await app.prisma.product.findUnique({
      where: { id: request.params.id },
      include: { category: true, variants: true },
    });
    if (!product) return reply.notFound("Product not found");

    const response: ApiResponse<typeof product> = { success: true, data: product };
    return response;
  });

  // Create product with variants (authenticated, admin roles)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createProductSchema.parse(request.body);
      const { variants: variantsInput, nutritionalInfo, ...productData } = body;

      const variantsToCreate = variantsInput && variantsInput.length > 0
        ? variantsInput
        : [{ name: "Default", unitType: "PIECE" as const, unitValue: 1 }];

      const product = await app.prisma.product.create({
        data: {
          ...productData,
          nutritionalInfo: nutritionalInfo as Prisma.InputJsonValue | undefined,
          variants: {
            create: variantsToCreate,
          },
        },
        include: { category: true, variants: true },
      });

      const response: ApiResponse<typeof product> = { success: true, data: product };
      return response;
    },
  );

  // Update product
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const { nutritionalInfo, ...rest } = updateProductSchema.parse(request.body);
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      const data: Prisma.ProductUncheckedUpdateInput = {
        ...rest,
        ...(nutritionalInfo !== undefined && {
          nutritionalInfo: nutritionalInfo === null ? Prisma.DbNull : nutritionalInfo as Prisma.InputJsonValue,
        }),
      };

      const product = await app.prisma.product.update({
        where: { id: request.params.id },
        data,
        include: { category: true, variants: true },
      });

      const response: ApiResponse<typeof product> = { success: true, data: product };
      return response;
    },
  );

  // Delete product
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      await app.prisma.product.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
