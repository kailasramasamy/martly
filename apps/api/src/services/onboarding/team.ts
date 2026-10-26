import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ONBOARDING_STAFF_ROLES, type OnboardingStaffInput } from "@martly/shared/schemas";
import type { OnboardingTeamMember } from "@martly/shared/types";
import { createLogin, fail, isPhoneEmail, upgradeShopperLogin } from "./owner.js";

type Tx = Prisma.TransactionClient;
const STAFF_ROLES: string[] = [...ONBOARDING_STAFF_ROLES];

export async function listTeam(prisma: PrismaClient, storeId: string): Promise<OnboardingTeamMember[]> {
  const links = await prisma.userStore.findMany({
    where: { storeId, role: { in: [...ONBOARDING_STAFF_ROLES] }, user: { deletedAt: null } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return links.map(({ user, role }) => ({
    userId: user.id,
    name: user.name,
    phone: user.phone,
    email: isPhoneEmail(user.email) ? null : user.email,
    role: role as OnboardingTeamMember["role"],
  }));
}

/** The login for a new team member: a new one, a shopper's account (once confirmed), or staff of the same business */
async function staffLogin(tx: Tx, organizationId: string, input: OnboardingStaffInput) {
  const existing = await tx.user.findFirst({
    where: { phone: input.phone, deletedAt: null },
    include: { userStores: { include: { store: { select: { organizationId: true } } } } },
  });
  if (!existing) return createLogin(tx, input, input.role);
  if (existing.role === "CUSTOMER") {
    if (!input.upgradeShopper) throw fail(`${input.phone} is a shopper's account. Confirm to turn it into their staff login`);
    return upgradeShopperLogin(tx, existing, input, input.role);
  }
  const sameBusiness = STAFF_ROLES.includes(existing.role) && existing.userStores.every((l) => l.store.organizationId === organizationId);
  if (!sameBusiness) throw fail(`${input.phone} already signs in for another business or role; use another number`);
  return existing;
}

export async function addTeamMember(prisma: PrismaClient, store: { id: string; organizationId: string }, input: OnboardingStaffInput) {
  await prisma.$transaction(async (tx) => {
    const user = await staffLogin(tx, store.organizationId, input);
    if (await tx.userStore.findUnique({ where: { userId_storeId: { userId: user.id, storeId: store.id } } })) {
      throw fail(`${input.name} is already on this store's team`);
    }
    await tx.userStore.create({ data: { userId: user.id, storeId: store.id, role: input.role } });
  });
}

/** Takes them off the store; a login left with no store goes back to a plain shopper account */
export async function removeTeamMember(prisma: PrismaClient, storeId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const link = await tx.userStore.findUnique({ where: { userId_storeId: { userId, storeId } } });
    if (!link || !STAFF_ROLES.includes(link.role)) throw fail("Not on this store's team", 404);
    await tx.userStore.delete({ where: { id: link.id } });
    if ((await tx.userStore.count({ where: { userId } })) === 0) {
      await tx.user.update({ where: { id: userId }, data: { role: "CUSTOMER" } });
    }
  });
}
