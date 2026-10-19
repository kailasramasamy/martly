import type { Messaging } from "firebase-admin/messaging";
import type { Permission } from "@martly/shared/constants";
import { effectivePermissions } from "@martly/shared/permissions";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { NotificationType } from "../../../generated/prisma/index.js";
import { sendNotification } from "../notification.js";
import { storeMembersWith } from "../permissions.js";

interface StaffAlert {
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

interface Audience {
  /** Members holding any of these permissions receive the alert */
  permissions?: Permission[];
  /** People who always receive it (a rider, the creator of a draft) */
  userIds?: (string | null | undefined)[];
  /** The person who caused the event doesn't need telling */
  excludeUserId?: string;
  /** Owners hear only escalations, or when nobody else would */
  escalation?: boolean;
}

type Member = { id: string; role: string };

async function orgOwners(prisma: PrismaClient, organizationId: string): Promise<Member[]> {
  return prisma.user.findMany({
    where: { role: "ORG_ADMIN", deletedAt: null, userStores: { some: { store: { organizationId } } } },
    select: { id: true, role: true },
  });
}

/** Members of any store in the organisation whose permissions include one of `permissions` */
async function orgMembersWith(prisma: PrismaClient, organizationId: string, permissions: Permission[]): Promise<Member[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, role: { notIn: ["CUSTOMER", "SUPER_ADMIN"] }, userStores: { some: { store: { organizationId } } } },
    select: { id: true, role: true, memberPermissions: { where: { organizationId }, select: { permissions: true } } },
  });
  return rows.filter((u) => {
    const held = effectivePermissions(u.role, u.memberPermissions[0]?.permissions);
    return permissions.some((p) => held.includes(p));
  });
}

async function deliver(fcm: Messaging | null, prisma: PrismaClient, members: Member[], owners: Member[], audience: Audience, alert: StaffAlert) {
  const staff = members.filter((m) => m.role !== "ORG_ADMIN");
  const direct = (audience.userIds ?? []).filter((id): id is string => !!id).map((id) => ({ id, role: "" }));
  const withOwners = audience.escalation || staff.length + direct.length === 0;
  const recipients = new Set([...staff, ...direct, ...(withOwners ? owners : [])].map((m) => m.id));
  if (audience.excludeUserId) recipients.delete(audience.excludeUserId);
  await Promise.all(
    [...recipients].map((userId) => sendNotification(fcm, prisma, { userId, ...alert, sound: true })),
  );
}

/** Alerts the people who run one store: members with the permissions, direct recipients, and owners on escalation */
export async function notifyStaff(
  fcm: Messaging | null,
  prisma: PrismaClient,
  storeId: string,
  audience: Audience,
  alert: StaffAlert,
) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
  if (!store) return;
  const [members, owners] = await Promise.all([
    Promise.all((audience.permissions ?? []).map((p) => storeMembersWith(prisma, storeId, p))).then((lists) => lists.flat()),
    orgOwners(prisma, store.organizationId),
  ]);
  await deliver(fcm, prisma, members, owners, audience, { ...alert, data: { storeId, ...alert.data } });
}

/** Alerts for organisation-wide work (promos, campaigns, brand ads) that isn't tied to one store */
export async function notifyOrgStaff(
  fcm: Messaging | null,
  prisma: PrismaClient,
  organizationId: string,
  audience: Audience,
  alert: StaffAlert,
) {
  const [members, owners] = await Promise.all([
    audience.permissions?.length ? orgMembersWith(prisma, organizationId, audience.permissions) : Promise.resolve([]),
    orgOwners(prisma, organizationId),
  ]);
  await deliver(fcm, prisma, members, owners, audience, alert);
}
