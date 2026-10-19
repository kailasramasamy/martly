import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ATTENTION_STALE_MINUTES, type AttentionKey } from "@martly/shared/constants";
import { claimOnce } from "./once.js";
import { notifyStaff } from "./staff.js";
import { plural } from "./copy.js";

type Waiting = { id: string; storeId: string | null };
type Finder = (prisma: PrismaClient, waitingSince: { lt: Date; gte: Date }) => Promise<Waiting[]>;

const MINUTE = 60 * 1000;
/** Older backlog was already visible on Today; escalating it all at once on deploy would only be noise */
const LOOKBACK = 7 * 24 * 60 * MINUTE;
const pick = { id: true, storeId: true } as const;

/** The items behind each Today row, by when they started waiting */
const FINDERS: Partial<Record<AttentionKey, Finder>> = {
  returns_review: (p, at) => p.returnRequest.findMany({ where: { status: "PENDING", createdAt: at }, select: pick }),
  ready_unassigned: (p, at) => p.order.findMany({ where: { status: "READY", fulfillmentType: "DELIVERY", deliveryTripId: null, updatedAt: at }, select: pick }),
  counts_approve: (p, at) => p.stockCount.findMany({ where: { status: "SUBMITTED", submittedAt: at }, select: pick }),
  reviews: (p, at) => p.review.findMany({ where: { status: "PENDING", createdAt: at }, select: pick }),
  tickets: (p, at) => p.supportTicket.findMany({ where: { status: "OPEN", createdAt: at }, select: pick }),
  catalog_drafts: (p, at) => p.catalogDraft.findMany({ where: { status: "NEEDS_REVIEW", createdAt: at }, select: pick }),
};

const waitText = (minutes: number) => (minutes < 60 ? `${minutes} min` : minutes < 48 * 60 ? `${minutes / 60}h` : `${minutes / (24 * 60)} days`);

const COPY: Partial<Record<AttentionKey, { type: "STAFF_SERVICE" | "STAFF_DELIVERY" | "STAFF_STOCK"; noun: string }>> = {
  returns_review: { type: "STAFF_SERVICE", noun: "return request" },
  ready_unassigned: { type: "STAFF_DELIVERY", noun: "packed order without a rider" },
  counts_approve: { type: "STAFF_STOCK", noun: "stock count" },
  reviews: { type: "STAFF_SERVICE", noun: "review" },
  tickets: { type: "STAFF_SERVICE", noun: "support ticket" },
  catalog_drafts: { type: "STAFF_STOCK", noun: "catalog draft" },
};

/** Owners hear about work that has waited past its limit, once per item, grouped per store */
async function escalateKind(fcm: Messaging | null, prisma: PrismaClient, key: AttentionKey, find: Finder, now: number) {
  const limit = ATTENTION_STALE_MINUTES[key];
  const copy = COPY[key];
  if (limit === null || !copy) return;
  const rows = await find(prisma, { lt: new Date(now - limit * MINUTE), gte: new Date(now - LOOKBACK) });
  const keyOf = (row: Waiting) => `stale:${key}:${row.id}`;
  const claimed = await claimOnce(prisma, rows.filter((r) => r.storeId).map(keyOf));
  const perStore = new Map<string, number>();
  for (const row of rows) {
    if (row.storeId && claimed.has(keyOf(row))) perStore.set(row.storeId, (perStore.get(row.storeId) ?? 0) + 1);
  }
  for (const [storeId, count] of perStore) {
    // No permissions plus escalation reaches the owners only; staff already had the original alert
    await notifyStaff(fcm, prisma, storeId, { permissions: [], escalation: true }, {
      type: copy.type,
      title: `${plural(count, copy.noun)} waiting over ${waitText(limit)}`,
      body: "Nobody has picked this up yet. Open Today to see what needs your attention.",
      data: { screen: "manage-today" },
    });
  }
}

export async function escalateStaleWork(fcm: Messaging | null, prisma: PrismaClient) {
  const now = Date.now();
  for (const [key, find] of Object.entries(FINDERS) as [AttentionKey, Finder][]) await escalateKind(fcm, prisma, key, find, now);
}
