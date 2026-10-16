import { ROLE_ADDONS, effectivePermissions } from "@martly/shared/permissions";
import type { Permission } from "@martly/shared/constants";
import type { PrismaClient } from "../../generated/prisma/client.js";

/** A member's effective permissions in one organization: role preset + owner-granted add-ons */
export async function resolvePermissions(
  prisma: PrismaClient,
  user: { id: string; role: string },
  organizationId?: string,
): Promise<Permission[]> {
  if (user.role === "CUSTOMER") return [];
  if (!organizationId || user.role === "SUPER_ADMIN" || user.role === "ORG_ADMIN") {
    return effectivePermissions(user.role);
  }
  const grant = await prisma.memberPermission.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    select: { permissions: true },
  });
  return effectivePermissions(user.role, grant?.permissions);
}

/** After a role change, drop add-ons the new role can't hold (in every organization) */
export async function pruneAddOns(prisma: PrismaClient, userId: string, role: string): Promise<void> {
  const allowed = ROLE_ADDONS[role] ?? [];
  const grants = await prisma.memberPermission.findMany({ where: { userId } });
  await Promise.all(
    grants.map((g) =>
      prisma.memberPermission.update({
        where: { id: g.id },
        data: { permissions: g.permissions.filter((p) => allowed.includes(p)) },
      }),
    ),
  );
}

/** Members assigned to a store whose effective permissions include `permission` */
export async function storeMembersWith(prisma: PrismaClient, storeId: string, permission: Permission) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
  if (!store) return [];
  const rows = await prisma.userStore.findMany({
    where: { storeId, user: { deletedAt: null } },
    select: {
      user: {
        select: {
          id: true, name: true, phone: true, email: true, role: true,
          memberPermissions: { where: { organizationId: store.organizationId }, select: { permissions: true } },
        },
      },
    },
  });
  return rows
    .filter(({ user }) => effectivePermissions(user.role, user.memberPermissions[0]?.permissions).includes(permission))
    .map(({ user }) => ({ id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }));
}

/** Members who can run deliveries for a store (owners and platform admins are not riders) */
export async function storeRiders(prisma: PrismaClient, storeId: string) {
  const members = await storeMembersWith(prisma, storeId, "DELIVERY_DELIVER");
  return members.filter((u) => u.role !== "ORG_ADMIN" && u.role !== "SUPER_ADMIN");
}
