import type { FastifyInstance } from "fastify";
import { updateMemberPermissionsSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import { ROLE_ADDONS, effectivePermissions } from "@martly/shared/permissions";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";

interface MemberAccess {
  role: string;
  addOns: Permission[];
  permissions: Permission[];
  grantable: readonly Permission[];
}

/** Owner-granted add-on responsibilities for a member, scoped to the caller's organization */
export async function memberPermissionRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, requirePermission(Permission.TEAM_MANAGE)];

  async function loadMember(userId: string, organizationId: string) {
    return app.prisma.user.findFirst({
      where: { id: userId, userStores: { some: { store: { organizationId } } } },
      select: {
        role: true,
        memberPermissions: { where: { organizationId }, select: { permissions: true } },
      },
    });
  }

  function access(role: string, addOns: Permission[]): MemberAccess {
    return { role, addOns, permissions: effectivePermissions(role, addOns), grantable: ROLE_ADDONS[role] ?? [] };
  }

  app.get<{ Params: { id: string } }>("/:id/permissions", { preHandler }, async (request, reply) => {
    const { organizationId } = request.user;
    if (!organizationId) return reply.badRequest("Select an organization first");
    const member = await loadMember(request.params.id, organizationId);
    if (!member) return reply.notFound("Member not found in this organization");

    const response: ApiResponse<MemberAccess> = {
      success: true,
      data: access(member.role, member.memberPermissions[0]?.permissions ?? []),
    };
    return response;
  });

  app.put<{ Params: { id: string } }>("/:id/permissions", { preHandler }, async (request, reply) => {
    const { organizationId } = request.user;
    if (!organizationId) return reply.badRequest("Select an organization first");
    const { permissions } = updateMemberPermissionsSchema.parse(request.body);
    const member = await loadMember(request.params.id, organizationId);
    if (!member) return reply.notFound("Member not found in this organization");

    const grantable = ROLE_ADDONS[member.role] ?? [];
    const invalid = permissions.filter((p) => !grantable.includes(p));
    if (invalid.length > 0) return reply.badRequest(`Not available for this role: ${invalid.join(", ")}`);

    const addOns = [...new Set(permissions)];
    await app.prisma.memberPermission.upsert({
      where: { userId_organizationId: { userId: request.params.id, organizationId } },
      create: { userId: request.params.id, organizationId, permissions: addOns },
      update: { permissions: addOns },
    });

    const response: ApiResponse<MemberAccess> = { success: true, data: access(member.role, addOns) };
    return response;
  });
}
