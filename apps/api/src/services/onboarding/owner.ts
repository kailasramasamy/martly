import bcrypt from "bcryptjs";
import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import type { OnboardingOwnerInput } from "@martly/shared/schemas";

type Tx = Prisma.TransactionClient;

export const fail = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

const PHONE_EMAIL = "@phone.martly.app";

/** OTP-only logins carry a placeholder email made from the phone */
export const isPhoneEmail = (email: string) => email.endsWith(PHONE_EMAIL);

export async function assertEmailFree(tx: Tx, email: string, exceptUserId?: string) {
  const taken = await tx.user.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== exceptUserId) throw fail(`${email} is already in use`);
}

/** Password fields for a login whose email is `email`; the admin panel signs in with email and password */
export async function passwordData(email: string, password?: string) {
  if (!password) return {};
  if (isPhoneEmail(email)) throw fail("Add an email with the password: the admin panel signs in with both", 400);
  return { passwordHash: await bcrypt.hash(password, 10) };
}

/** A new login on this phone; without a password it signs in by OTP only */
export async function createLogin(tx: Tx, person: OnboardingOwnerInput, role: UserRole) {
  const email = person.email ?? `${person.phone}${PHONE_EMAIL}`;
  await assertEmailFree(tx, email);
  const passwordHash = (await passwordData(email, person.password)).passwordHash ?? (await bcrypt.hash(crypto.randomUUID(), 10));
  return tx.user.create({ data: { email, name: person.name, phone: person.phone, passwordHash, role } });
}

/** A shopper account on the phone becomes the owner's or a staff login; their orders and wallet stay */
export async function upgradeShopperLogin(tx: Tx, existing: { id: string; name: string; email: string }, person: OnboardingOwnerInput, role: UserRole) {
  const email = person.email && isPhoneEmail(existing.email) ? person.email : existing.email;
  if (email !== existing.email) await assertEmailFree(tx, email);
  return tx.user.update({
    where: { id: existing.id },
    data: { role, name: existing.name || person.name, email, ...(await passwordData(email, person.password)) },
  });
}

/** First free `base`, `base-2`, `base-3`… among the slugs already taken */
export function firstFreeSlug(base: string, taken: string[]) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * The login the organisation's owner signs in with by OTP: a new ORG_ADMIN, an owner who already runs another
 * organisation, or, when Martly confirmed it, the shopper account already on that phone turned into the owner's.
 */
export async function resolveOwner(tx: Tx, owner: OnboardingOwnerInput, upgradeShopper: boolean) {
  const existing = await tx.user.findFirst({ where: { phone: owner.phone, deletedAt: null } });
  if (!existing) return createLogin(tx, owner, "ORG_ADMIN");

  if (existing.role === "ORG_ADMIN") return existing;
  if (existing.role !== "CUSTOMER") {
    throw fail(`${owner.phone} is already a ${existing.role.replace("_", " ").toLowerCase()} login; use another number`);
  }
  if (!upgradeShopper) throw fail(`${owner.phone} is a shopper's account. Confirm to turn it into the owner's login`);

  return upgradeShopperLogin(tx, existing, owner, "ORG_ADMIN");
}
