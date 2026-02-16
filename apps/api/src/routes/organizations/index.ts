import type { FastifyInstance } from "fastify";
import { createOrganizationSchema, updateOrganizationSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function organizationRoutes(app: FastifyInstance) {
  // List organizations (SUPER_ADMIN only)
  app.get("/", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request) => {
    const { page = 1, pageSize = 20, q } = request.query as { page?: number; pageSize?: number; q?: string };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } }] }
      : {};

    const [organizations, total] = await Promise.all([
      app.prisma.organization.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: "desc" } }),
      app.prisma.organization.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof organizations)[0]> = {
      success: true,
      data: organizations,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get organization by ID (SUPER_ADMIN only)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN")] }, async (request, reply) => {
    const org = await app.prisma.organization.findUnique({ where: { id: request.params.id } });
    if (!org) return reply.notFound("Organization not found");

    const response: ApiResponse<typeof org> = { success: true, data: org };
    return response;
  });

  // Create organization
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request) => {
      const body = createOrganizationSchema.parse(request.body);
      const org = await app.prisma.organization.create({ data: body });

      const response: ApiResponse<typeof org> = { success: true, data: org };
      return response;
    },
  );

  // Update organization
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request, reply) => {
      const body = updateOrganizationSchema.parse(request.body);
      const existing = await app.prisma.organization.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Organization not found");

      const org = await app.prisma.organization.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof org> = { success: true, data: org };
      return response;
    },
  );

  // Delete organization
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.organization.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Organization not found");

      await app.prisma.organization.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
