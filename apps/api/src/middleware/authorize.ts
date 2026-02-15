import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@martly/shared/constants";

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { sub: string; role: string };
    if (!roles.includes(user.role as UserRole)) {
      return reply.forbidden("Insufficient permissions");
    }
  };
}
