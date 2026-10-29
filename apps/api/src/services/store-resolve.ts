import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { StoreResolveQuery } from "@martly/shared/schemas";
import type { StoreResolution } from "@martly/shared/types";
import { haversine } from "../lib/geo.js";
import { drivingDistances, type Drive } from "./driving-distance.js";
import { getStoreDiscoveryInfo, type StoreDiscoveryInfo } from "./store-discovery.js";

/** Stores shoppers can see: launched, and not the Martly Template org's */
export const liveStoreWhere = { status: "ACTIVE", organization: { isTemplate: false } } satisfies Prisma.StoreWhereInput;

/**
 * Stores on martlyshop.in: live, with a paid plan running now; the web store follows the plan, off on Free and back when a paid plan starts.
 * Martly can keep an organisation on regardless (webStoreAlwaysOn, e.g. beta stores)
 */
export const webStoreWhere = (at = new Date()) => ({
  ...liveStoreWhere,
  organization: {
    isTemplate: false,
    OR: [{ webStoreAlwaysOn: true }, { planPeriods: { some: { startsAt: { lte: at }, endsAt: { gt: at }, product: { price: { gt: 0 } } } } }],
  },
}) satisfies Prisma.StoreWhereInput;

/** Shoppers and guests never see template stores; staff see only their own org's stores, so the template is the platform admin's alone */
export const hidesTemplateStores = (user: { role: string }) => user.role === "GUEST" || user.role === "CUSTOMER";

/** How far around the shopper to look when picking their store, as the app's nearby search */
const RESOLVE_RADIUS_KM = 20;

const storeInclude = { organization: { select: { subscriptionEnabled: true } } } satisfies Prisma.StoreInclude;
type StoreRow = Prisma.StoreGetPayload<{ include: typeof storeInclude }>;

interface Reach {
  distance: number;
  /** Road distance for display; delivery eligibility and fees stay on straight-line distance, as at checkout */
  drive: Drive | null;
  deliversToYou: boolean;
}

export type CustomerStore = Omit<StoreRow, "organization"> & StoreDiscoveryInfo & Partial<Reach>;

/** Store rows as customer store lists show them: discovery info, the org's subscription switch, and reach when known */
async function present(prisma: PrismaClient, rows: StoreRow[], reach?: Map<string, Reach>): Promise<CustomerStore[]> {
  const discovery = await getStoreDiscoveryInfo(prisma, rows.map((s) => s.id));
  return rows.map(({ organization, ...store }) => ({
    ...store,
    ...discovery.get(store.id)!,
    subscriptionEnabled: store.subscriptionEnabled && organization.subscriptionEnabled,
    ...reach?.get(store.id),
  }));
}

/** Live stores within radiusKm of the point, nearest first, each saying whether it delivers there */
export async function nearbyStores(prisma: PrismaClient, point: { lat: number; lng: number }, radiusKm: number, scope: Prisma.StoreWhereInput = liveStoreWhere) {
  const stores = await prisma.store.findMany({
    where: { ...scope, latitude: { not: null }, longitude: { not: null } },
    include: storeInclude,
  });
  const inRange = stores
    .map((store) => ({ store, distance: haversine(point.lat, point.lng, store.latitude!, store.longitude!) }))
    .filter((s) => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  const ids = inRange.map((s) => s.store.id);
  const [tiers, drives] = await Promise.all([
    prisma.deliveryTier.findMany({ where: { storeId: { in: ids }, isActive: true }, select: { storeId: true, minDistance: true, maxDistance: true } }),
    drivingDistances(point, inRange.map(({ store }) => ({ id: store.id, lat: store.latitude!, lng: store.longitude! }))),
  ]);
  // Same rule as checkout's delivery lookup: within radius AND an active tier covers the distance
  const hasTier = (storeId: string, distance: number) =>
    tiers.some((t) => t.storeId === storeId && t.minDistance <= distance && t.maxDistance > distance);
  const reach = new Map(inRange.map(({ store, distance }) => [store.id, {
    distance,
    drive: drives.get(store.id) ?? null,
    deliversToYou: distance <= store.deliveryRadius && hasTier(store.id, distance),
  }]));
  return present(prisma, inRange.map((s) => s.store), reach);
}

/** The store a town opens on: the one with the most on its shelves, then the first launched; no town means all of Martly */
async function mainStore(prisma: PrismaClient, scope: Prisma.StoreWhereInput, townId?: string): Promise<StoreRow | null> {
  const stores = await prisma.store.findMany({ where: { ...scope, ...(townId && { townId }) }, include: storeInclude });
  if (!stores.length) return townId ? mainStore(prisma, scope) : null;
  const counts = await prisma.storeProduct.groupBy({
    by: ["storeId"],
    where: { storeId: { in: stores.map((s) => s.id) }, isActive: true, product: { isActive: true } },
    _count: { _all: true },
  });
  const stocked = new Map(counts.map((c) => [c.storeId, c._count._all]));
  const launched = (s: StoreRow) => (s.launchedAt ?? s.createdAt).getTime();
  return stores.sort((a, b) => (stocked.get(b.id) ?? 0) - (stocked.get(a.id) ?? 0) || launched(a) - launched(b))[0];
}

async function liveStoreById(prisma: PrismaClient, scope: Prisma.StoreWhereInput, id: string) {
  const row = await prisma.store.findFirst({ where: { ...scope, id }, include: storeInclude });
  return row ? (await present(prisma, [row]))[0] : null;
}

/** The other live stores in a store's town, for the shopper to switch to */
async function townmates(prisma: PrismaClient, scope: Prisma.StoreWhereInput, store: { id: string; townId: string }) {
  const rows = await prisma.store.findMany({ where: { ...scope, townId: store.townId, id: { not: store.id } }, include: storeInclude, orderBy: { name: "asc" } });
  return present(prisma, rows);
}

/**
 * Picks the store a shopper browses without asking them: the one they already use while it is live,
 * else the nearest that delivers to them, else their town's main store, else Martly's main store; scope narrows the stores it may pick
 */
export async function resolveStore(prisma: PrismaClient, query: StoreResolveQuery, scope: Prisma.StoreWhereInput = liveStoreWhere): Promise<StoreResolution<CustomerStore> | null> {
  const point = query.lat != null && query.lng != null ? { lat: query.lat, lng: query.lng } : null;
  const near = point ? await nearbyStores(prisma, point, RESOLVE_RADIUS_KM, scope) : [];
  const others = (store: CustomerStore) => (point ? Promise.resolve(near.filter((s) => s.id !== store.id)) : townmates(prisma, scope, store));
  const result = async (store: CustomerStore, reason: StoreResolution<CustomerStore>["reason"]) => ({
    store,
    reason,
    deliversToYou: point ? store.deliversToYou ?? false : null,
    alternatives: await others(store),
  });

  if (query.current) {
    const kept = near.find((s) => s.id === query.current) ?? (await liveStoreById(prisma, scope, query.current));
    if (kept) return result(kept, "kept");
  }
  const nearest = near.find((s) => s.deliversToYou) ?? near[0];
  if (nearest) return result(nearest, "nearest");

  const town = query.town ? await prisma.town.findUnique({ where: { slug: query.town }, select: { id: true } }) : null;
  const main = await mainStore(prisma, scope, town?.id);
  if (!main) return null;
  const [store] = await present(prisma, [main]);
  return result(store, town && main.townId === town.id ? "town" : "default");
}
