import type { PrismaClient, Prisma } from "../../../generated/prisma/client.js";
import { STATE_TO_REGION } from "@martly/shared/constants";
import type { CreateOnboardingInput, OnboardingStoreInput, UpdateOnboardingInput } from "@martly/shared/schemas";
import { slugify } from "../brands.js";
import { assertEmailFree, firstFreeSlug, passwordData, resolveOwner } from "./owner.js";

type Tx = Prisma.TransactionClient;

/** The region a store shops in, from its state; null where no region code exists (national brands only) */
export function regionOf(state: string | null) {
  return (state && STATE_TO_REGION[state as keyof typeof STATE_TO_REGION]) || null;
}

async function freeSlug(tx: Tx, model: "organization" | "store", name: string) {
  const base = slugify(name) || model;
  const where = { slug: { startsWith: base } };
  const rows = model === "organization"
    ? await tx.organization.findMany({ where, select: { slug: true } })
    : await tx.store.findMany({ where, select: { slug: true } });
  return firstFreeSlug(base, rows.map((r) => r.slug));
}

/** Store columns from the form; express hours and ETA live on the express delivery config */
function storeData<T extends Partial<OnboardingStoreInput>>(store: T): Omit<T, "expressEtaMinutes" | "opensAt" | "closesAt"> {
  const { expressEtaMinutes: _eta, opensAt: _open, closesAt: _close, ...rest } = store;
  return rest;
}

/** Three distance bands up to the radius, so checkout finds a fee for every address the store delivers to */
async function writeDeliveryTiers(tx: Tx, storeId: string, radius: number, baseFee: number, etaMinutes: number) {
  const third = radius / 3;
  const round = (n: number) => Math.round(n * 10) / 10;
  await tx.deliveryTier.deleteMany({ where: { storeId } });
  await tx.deliveryTier.createMany({
    data: [0, 1, 2].map((i) => ({
      storeId,
      minDistance: round(i * third),
      maxDistance: i === 2 ? radius : round((i + 1) * third),
      deliveryFee: baseFee + i * 10,
      estimatedMinutes: etaMinutes + i * 5,
    })),
  });
}

async function writeExpress(tx: Tx, storeId: string, s: Pick<OnboardingStoreInput, "expressEtaMinutes" | "opensAt" | "closesAt">) {
  const data = { isEnabled: true, etaMinutes: s.expressEtaMinutes, operatingStart: s.opensAt, operatingEnd: s.closesAt };
  await tx.expressDeliveryConfig.upsert({ where: { storeId }, update: data, create: { ...data, storeId } });
}

/** A new organisation, its first store (hidden until launch), the owner's login and delivery set up from the details */
export async function createOnboarding(prisma: PrismaClient, input: CreateOnboardingInput) {
  return prisma.$transaction(async (tx) => {
    const region = regionOf(input.store.state);
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug: await freeSlug(tx, "organization", input.organizationName),
        festivalRegions: region ? [region] : ["ALL"],
      },
    });
    const store = await tx.store.create({
      data: {
        ...storeData(input.store),
        organizationId: organization.id,
        slug: await freeSlug(tx, "store", `${input.store.name} ${input.store.district}`),
        status: "PENDING",
      },
    });
    const s = input.store;
    await writeDeliveryTiers(tx, store.id, s.deliveryRadius, s.baseDeliveryFee, s.expressEtaMinutes);
    await writeExpress(tx, store.id, s);
    const owner = await resolveOwner(tx, input.owner, input.upgradeShopper);
    await tx.userStore.create({ data: { userId: owner.id, storeId: store.id, role: "ORG_ADMIN" } });
    return store;
  });
}

/** Edits from the details steps; delivery bands follow a changed radius, fee or ETA */
export async function updateOnboarding(prisma: PrismaClient, storeId: string, input: UpdateOnboardingInput) {
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    if (input.organizationName) {
      await tx.organization.update({ where: { id: store.organizationId }, data: { name: input.organizationName } });
    }
    const s = input.store ?? {};
    const region = s.state ? regionOf(s.state) : undefined;
    if (region !== undefined) {
      await tx.organization.update({ where: { id: store.organizationId }, data: { festivalRegions: region ? [region] : ["ALL"] } });
    }
    const updated = await tx.store.update({ where: { id: storeId }, data: { ...storeData(s), ...(input.size ? { size: input.size } : {}) } });
    await updateOwner(tx, storeId, input.owner);
    await refreshDelivery(tx, updated, s);
    return updated;
  });
}

async function updateOwner(tx: Tx, storeId: string, owner: UpdateOnboardingInput["owner"]) {
  if (!owner?.name && !owner?.email && !owner?.password) return;
  const link = await tx.userStore.findFirst({ where: { storeId, role: "ORG_ADMIN" }, orderBy: { createdAt: "asc" }, include: { user: true } });
  if (!link) return;
  const { password, ...details } = owner;
  const email = details.email ?? link.user.email;
  if (email !== link.user.email) await assertEmailFree(tx, email, link.userId);
  await tx.user.update({ where: { id: link.userId }, data: { ...details, ...(await passwordData(email, password)) } });
}

type StoreRow = Awaited<ReturnType<Tx["store"]["update"]>>;

async function refreshDelivery(tx: Tx, store: StoreRow, s: Partial<OnboardingStoreInput>) {
  const express = await tx.expressDeliveryConfig.findUnique({ where: { storeId: store.id } });
  const eta = s.expressEtaMinutes ?? express?.etaMinutes ?? 30;
  if (s.deliveryRadius !== undefined || s.baseDeliveryFee !== undefined || s.expressEtaMinutes !== undefined) {
    await writeDeliveryTiers(tx, store.id, store.deliveryRadius, Number(store.baseDeliveryFee ?? 0), eta);
  }
  if (s.expressEtaMinutes !== undefined || s.opensAt || s.closesAt) {
    await writeExpress(tx, store.id, {
      expressEtaMinutes: eta,
      opensAt: s.opensAt ?? express?.operatingStart ?? "07:00",
      closesAt: s.closesAt ?? express?.operatingEnd ?? "21:00",
    });
  }
}
