import type { FastifyRequest, FastifyReply } from "fastify";
import type { Permission, UserRole } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";

/** For platform-only (SUPER_ADMIN) and shopper-only (CUSTOMER) routes; staff routes use requirePermission */
export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!roles.includes(request.user.role as UserRole)) {
      return reply.forbidden("Insufficient permissions");
    }
  };
}

/** Passes when the member holds any of the given permissions (read from the access token) */
export function requirePermission(...permissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (request.user.role === "SUPER_ADMIN") return;
    if (!hasPermission(request.user.permissions, ...permissions)) {
      return reply.forbidden("You don't have permission to do this");
    }
  };
}
