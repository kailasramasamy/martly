import type { FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";

interface OrgUser {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
}

/** Extract typed user payload from JWT, or a GUEST stub when unauthenticated */
export function getOrgUser(request: FastifyRequest): OrgUser {
  if (!request.user) return { sub: "", email: "", role: "GUEST" };
  return request.user as OrgUser;
}

/** Middleware: rejects if a non-SUPER_ADMIN user lacks organizationId in JWT */
export async function requireOrgContext(request: FastifyRequest, reply: FastifyReply) {
  const user = getOrgUser(request);
  if (user.role === "SUPER_ADMIN" || user.role === "CUSTOMER") return;
  if (!user.organizationId) {
    return reply.forbidden("Organization context required");
  }
}

/** Returns a Prisma `where` filter for stores: `{ organizationId }` or `{}` for SUPER_ADMIN/GUEST */
export function orgScopedStoreFilter(request: FastifyRequest): { organizationId?: string } {
  const user = getOrgUser(request);
  if (user.role === "SUPER_ADMIN" || user.role === "GUEST") return {};
  return user.organizationId ? { organizationId: user.organizationId } : {};
}

/** Returns store IDs belonging to user's org, or `undefined` for SUPER_ADMIN/GUEST (meaning "all").
 *  For STORE_MANAGER/STAFF: returns only stores assigned via UserStore. */
export async function getOrgStoreIds(
  request: FastifyRequest,
  prisma: PrismaClient,
): Promise<string[] | undefined> {
  const user = getOrgUser(request);
  if (user.role === "SUPER_ADMIN" || user.role === "GUEST" || user.role === "CUSTOMER") return undefined;
  if (!user.organizationId) return [];

  // STORE_MANAGER / STAFF: scoped to assigned stores only
  if (user.role === "STORE_MANAGER" || user.role === "STAFF") {
    const userStores = await prisma.userStore.findMany({
      where: { userId: user.sub },
      select: { storeId: true },
    });
    return userStores.map((us: { storeId: string }) => us.storeId);
  }

  // ORG_ADMIN: all stores in their org
  const stores = await prisma.store.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true },
  });
  return stores.map((s: { id: string }) => s.id);
}

/** Returns true if the given storeId belongs to the user's org (always true for SUPER_ADMIN/GUEST).
 *  For STORE_MANAGER/STAFF: checks UserStore assignment instead of org-wide access. */
export async function verifyStoreOrgAccess(
  request: FastifyRequest,
  prisma: PrismaClient,
  storeId: string,
): Promise<boolean> {
  const user = getOrgUser(request);
  if (user.role === "SUPER_ADMIN" || user.role === "GUEST" || user.role === "CUSTOMER") return true;
  if (!user.organizationId) return false;

  // STORE_MANAGER / STAFF: must be assigned to this specific store
  if (user.role === "STORE_MANAGER" || user.role === "STAFF") {
    const assignment = await prisma.userStore.findUnique({
      where: { userId_storeId: { userId: user.sub, storeId } },
    });
    return !!assignment;
  }

  // ORG_ADMIN: any store in their org
  const store = await prisma.store.findFirst({
    where: { id: storeId, organizationId: user.organizationId },
  });
  return !!store;
}
