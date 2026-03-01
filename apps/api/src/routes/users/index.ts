import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export async function userRoutes(app: FastifyInstance) {
  // List users (SUPER_ADMIN: all non-CUSTOMER, ORG_ADMIN: users in their org via UserStore)
  app.get(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const { page = 1, pageSize = 20, q, role: roleFilter } = request.query as {
        page?: number; pageSize?: number; q?: string; role?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);
      const user = getOrgUser(request);

      const userSelect = {
        id: true, email: true, name: true, phone: true, role: true, createdAt: true, updatedAt: true,
        userStores: {
          select: {
            store: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
          },
        },
        _count: { select: { orders: true } },
      };

      if (user.role === "SUPER_ADMIN") {
        const where: Record<string, unknown> = {
          role: roleFilter ? roleFilter : { not: "CUSTOMER" },
        };
        if (q) {
          where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ];
        }

        const [users, total] = await Promise.all([
          app.prisma.user.findMany({
            where,
            skip,
            take: Number(pageSize),
            orderBy: { createdAt: "desc" },
            select: userSelect,
          }),
          app.prisma.user.count({ where }),
        ]);

        const response: PaginatedResponse<(typeof users)[0]> = {
          success: true,
          data: users,
          meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
        };
        return response;
      }

      // ORG_ADMIN: users who have UserStore entries in their org's stores
      const orgId = user.organizationId;
      if (!orgId) return { success: true, data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } };

      // Find distinct user IDs in this org's stores
      const orgUserStores = await app.prisma.userStore.findMany({
        where: { store: { organizationId: orgId } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const orgUserIds = orgUserStores.map((us: { userId: string }) => us.userId);

      const where: Record<string, unknown> = {
        id: { in: orgUserIds },
        role: { not: "SUPER_ADMIN" },
      };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ];
      }

      const [users, total] = await Promise.all([
        app.prisma.user.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { createdAt: "desc" },
          select: userSelect,
        }),
        app.prisma.user.count({ where }),
      ]);

      const response: PaginatedResponse<(typeof users)[0]> = {
        success: true,
        data: users,
        meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
      };
      return response;
    },
  );

  // Get user by ID
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const targetUser = await app.prisma.user.findUnique({
        where: { id: request.params.id },
        select: {
          id: true, email: true, name: true, phone: true, role: true, referralCode: true, createdAt: true, updatedAt: true,
          _count: { select: { orders: true, reviews: true } },
          addresses: { select: { id: true, label: true, address: true, isDefault: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        },
      });
      if (!targetUser) return reply.notFound("User not found");

      const user = getOrgUser(request);
      if (user.role !== "SUPER_ADMIN") {
        // ORG_ADMIN: verify user belongs to their org
        const membership = await app.prisma.userStore.findFirst({
          where: { userId: targetUser.id, store: { organizationId: user.organizationId } },
        });
        if (!membership) return reply.forbidden("Access denied");
      }

      const response: ApiResponse<typeof targetUser> = { success: true, data: targetUser };
      return response;
    },
  );

  // Create user
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const user = getOrgUser(request);

      // ORG_ADMIN can only create STORE_MANAGER or STAFF
      if (user.role === "ORG_ADMIN") {
        if (body.role !== "STORE_MANAGER" && body.role !== "STAFF") {
          return reply.forbidden("Org Admin can only create Store Manager or Staff users");
        }
      }

      // Check for duplicate email
      const existing = await app.prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return reply.conflict("A user with this email already exists");

      const passwordHash = await bcrypt.hash(body.password, 10);
      const newUser = await app.prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          phone: body.phone,
          role: body.role,
        },
        select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, updatedAt: true },
      });

      const response: ApiResponse<typeof newUser> = { success: true, data: newUser };
      return response;
    },
  );

  // Update user
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { name, phone, role, email, password } = request.body as {
        name?: string; phone?: string; role?: string; email?: string; password?: string;
      };

      const targetUser = await app.prisma.user.findUnique({ where: { id: request.params.id } });
      if (!targetUser) return reply.notFound("User not found");

      const user = getOrgUser(request);

      if (user.role === "ORG_ADMIN") {
        // Verify user belongs to their org
        const membership = await app.prisma.userStore.findFirst({
          where: { userId: targetUser.id, store: { organizationId: user.organizationId } },
        });
        if (!membership) return reply.forbidden("Access denied");

        // Can only set role to STORE_MANAGER or STAFF
        if (role && role !== "STORE_MANAGER" && role !== "STAFF") {
          return reply.forbidden("Org Admin can only assign Store Manager or Staff roles");
        }

        // ORG_ADMIN cannot change email or password
        if (email || password) {
          return reply.forbidden("Only Super Admin can change email or password");
        }
      }

      // Check email uniqueness if changing
      if (email && email !== targetUser.email) {
        const existing = await app.prisma.user.findUnique({ where: { email } });
        if (existing) return reply.conflict("A user with this email already exists");
      }

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (phone !== undefined) data.phone = phone;
      if (role !== undefined) data.role = role;
      if (email !== undefined) data.email = email;
      if (password && password.length >= 8) {
        data.passwordHash = await bcrypt.hash(password, 10);
      }

      const updated = await app.prisma.user.update({
        where: { id: request.params.id },
        data,
        select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, updatedAt: true },
      });

      const response: ApiResponse<typeof updated> = { success: true, data: updated };
      return response;
    },
  );

  // Delete user
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const targetUser = await app.prisma.user.findUnique({ where: { id: request.params.id } });
      if (!targetUser) return reply.notFound("User not found");

      const user = getOrgUser(request);

      if (user.role === "ORG_ADMIN") {
        // Verify user belongs to their org
        const membership = await app.prisma.userStore.findFirst({
          where: { userId: targetUser.id, store: { organizationId: user.organizationId } },
        });
        if (!membership) return reply.forbidden("Access denied");

        // Can't delete admins
        if (targetUser.role === "SUPER_ADMIN" || targetUser.role === "ORG_ADMIN") {
          return reply.forbidden("Cannot delete admin users");
        }
      }

      const userId = request.params.id;

      // Complete cleanup in a transaction — delete all associated data
      await app.prisma.$transaction(async (tx) => {
        // 1. Delete order sub-records (must come before orders)
        await tx.couponRedemption.deleteMany({ where: { order: { userId } } });
        await tx.orderStatusLog.deleteMany({ where: { order: { userId } } });
        await tx.orderItem.deleteMany({ where: { order: { userId } } });

        // 2. Delete orders
        await tx.order.deleteMany({ where: { userId } });

        // 3. Delete reviews
        await tx.review.deleteMany({ where: { userId } });

        // 4. Delete standalone coupon redemptions (if any not tied to orders)
        await tx.couponRedemption.deleteMany({ where: { userId } });

        // 5. Delete user-store assignments
        await tx.userStore.deleteMany({ where: { userId } });

        // 6. Delete the user (cascades: addresses, device tokens, wishlist items)
        await tx.user.delete({ where: { id: userId } });
      });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
