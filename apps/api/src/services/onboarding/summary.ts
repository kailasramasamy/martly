import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { OnboardingSummary } from "@martly/shared/types";
import { regionOf } from "./create.js";
import { townSelect } from "../towns.js";

const include = {
  organization: { select: { id: true, name: true, slug: true } },
  userStores: { where: { role: "ORG_ADMIN" }, orderBy: { createdAt: "asc" }, take: 1, include: { user: { select: { id: true, name: true, phone: true, email: true } } } },
  expressDeliveryConfig: true,
  town: { select: townSelect },
  _count: { select: { storeProducts: true } },
} satisfies Prisma.StoreInclude;

type Row = Prisma.StoreGetPayload<{ include: typeof include }>;

function toSummary(s: Row, sections: number): OnboardingSummary {
  return {
    storeId: s.id,
    storeName: s.name,
    status: s.status,
    organization: s.organization,
    owner: s.userStores[0]?.user ?? null,
    size: s.size,
    region: regionOf(s.state),
    listings: s._count.storeProducts,
    storefrontCopied: sections > 0,
    createdAt: s.createdAt.toISOString(),
    launchedAt: s.launchedAt?.toISOString() ?? null,
  };
}

async function sectionCounts(prisma: PrismaClient, orgIds: string[]) {
  const rows = await prisma.homeSection.groupBy({ by: ["organizationId"], where: { organizationId: { in: orgIds } }, _count: true });
  return new Map(rows.map((r) => [r.organizationId, r._count]));
}

/** Stores being set up and stores launched from onboarding, newest first */
export async function listOnboarding(prisma: PrismaClient) {
  const stores = await prisma.store.findMany({
    where: { OR: [{ status: "PENDING" }, { launchedAt: { not: null } }] },
    include,
    orderBy: { createdAt: "desc" },
  });
  const sections = await sectionCounts(prisma, stores.map((s) => s.organizationId));
  return stores.map((s) => toSummary(s, sections.get(s.organizationId) ?? 0));
}

/** One store's onboarding, with the details the wizard's forms reopen with */
export async function getOnboarding(prisma: PrismaClient, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, include });
  if (!store) return null;
  const sections = await sectionCounts(prisma, [store.organizationId]);
  const { _count, userStores: _u, organization: _o, expressDeliveryConfig: express, ...details } = store;
  return {
    ...toSummary(store, sections.get(store.organizationId) ?? 0),
    details: {
      ...details,
      expressEtaMinutes: express?.etaMinutes ?? null,
      opensAt: express?.operatingStart ?? null,
      closesAt: express?.operatingEnd ?? null,
    },
  };
}
