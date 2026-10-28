import type { PrismaClient } from "../../generated/prisma/client.js";
import { hasPermission } from "@martly/shared/permissions";
import { Permission, type AttentionKey } from "@martly/shared/constants";
import type { JwtUser } from "../types/jwt.js";

export interface AttentionItem {
  key: AttentionKey;
  count: number;
  /** When the oldest waiting item started waiting */
  oldestAt: Date | null;
}

type StoreFilter = { storeId?: string | { in: string[] } };
type Counter = { key: AttentionKey; permission: Permission; run: () => Promise<{ count: number; oldestAt: Date | null }> };

/** Prisma twin of IN_RANGE in services/listing-sql.ts: what the store carries or shows without having confirmed */
const IN_RANGE = [{ carried: true }, { carried: null, suggested: false }];

const tally = (r: { _count: { _all: number }; _min: Record<string, Date | null> }, field: string) => ({ count: r._count._all, oldestAt: r._min[field] ?? null });

/** One count per kind of work a manager may need to act on, in the order the card lists them */
function counters(prisma: PrismaClient, store: StoreFilter): Counter[] {
  return [
    { key: "returns_review", permission: Permission.RETURNS_HANDLE, run: async () => tally(await prisma.returnRequest.aggregate({ where: { ...store, status: "PENDING" }, _count: { _all: true }, _min: { createdAt: true } }), "createdAt") },
    { key: "returns_drop", permission: Permission.RETURNS_HANDLE, run: async () => tally(await prisma.returnRequest.aggregate({ where: { ...store, status: "IN_PROGRESS", method: "AT_STORE", receivedAt: null }, _count: { _all: true }, _min: { resolvedAt: true } }), "resolvedAt") },
    { key: "ready_unassigned", permission: Permission.ORDERS_DISPATCH, run: async () => tally(await prisma.order.aggregate({ where: { ...store, status: "READY", fulfillmentType: "DELIVERY", deliveryTripId: null }, _count: { _all: true }, _min: { updatedAt: true } }), "updatedAt") },
    { key: "counts_approve", permission: Permission.STOCK_APPROVE, run: async () => tally(await prisma.stockCount.aggregate({ where: { ...store, status: "SUBMITTED" }, _count: { _all: true }, _min: { submittedAt: true } }), "submittedAt") },
    { key: "recounts", permission: Permission.STOCK_COUNT, run: async () => tally(await prisma.stockCount.aggregate({ where: { ...store, status: "RECOUNT" }, _count: { _all: true }, _min: { reviewedAt: true } }), "reviewedAt") },
    { key: "reviews", permission: Permission.MARKETING_MANAGE, run: async () => tally(await prisma.review.aggregate({ where: { ...store, status: "PENDING" }, _count: { _all: true }, _min: { createdAt: true } }), "createdAt") },
    { key: "tickets", permission: Permission.SUPPORT_HANDLE, run: async () => tally(await prisma.supportTicket.aggregate({ where: { ...store, status: "OPEN" }, _count: { _all: true }, _min: { createdAt: true } }), "createdAt") },
    { key: "catalog_drafts", permission: Permission.CATALOG_PRODUCTS, run: async () => tally(await prisma.catalogDraft.aggregate({ where: { ...store, status: "NEEDS_REVIEW" }, _count: { _all: true }, _min: { createdAt: true } }), "createdAt") },
    // Listings wait from onboarding, so their age says nothing; only the count matters
    { key: "stock_check", permission: Permission.LISTING_AVAILABILITY, run: async () => ({ count: await prisma.storeProduct.count({ where: { ...store, carried: null } }), oldestAt: null }) },
    { key: "price_review", permission: Permission.LISTING_PRICES, run: async () => ({ count: await prisma.storeProduct.count({ where: { ...store, priceReviewedAt: null, OR: IN_RANGE } }), oldestAt: null }) },
  ];
}

/** Work waiting on this member across their stores, limited to what their permissions let them act on */
export async function attentionFor(prisma: PrismaClient, user: JwtUser, store: StoreFilter): Promise<AttentionItem[]> {
  const allowed = counters(prisma, store).filter((c) => user.role === "SUPER_ADMIN" || hasPermission(user.permissions, c.permission));
  // Approvers handle submitted counts; recounts are for the counters themselves
  const relevant = allowed.filter((c) => c.key !== "recounts" || !hasPermission(user.permissions, Permission.STOCK_APPROVE));
  const results = await Promise.all(relevant.map(async (c) => ({ key: c.key, ...(await c.run()) })));
  return results.filter((r) => r.count > 0);
}
