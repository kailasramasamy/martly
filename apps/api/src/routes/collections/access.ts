import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export const ADMINS = [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")];

// ORG_ADMIN may only touch its own org's collections; sends the error reply and returns undefined otherwise
export async function ownCollection(app: FastifyInstance, request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const collection = await app.prisma.collection.findUnique({
    where: { id: request.params.id },
    include: { festivalEvent: { select: { name: true, guidance: true } } },
  });
  if (!collection) return void reply.notFound("Collection not found");
  const user = getOrgUser(request);
  if (user.role === "ORG_ADMIN" && collection.organizationId !== user.organizationId) return void reply.forbidden("Access denied");
  return collection;
}
