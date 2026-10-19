import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istNow } from "../ist-day.js";
import { alertOnce } from "./once.js";
import { plural } from "./copy.js";
import { notifyStaff } from "./staff.js";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const SOLD_WITHIN_DAYS = 30;
const NAMES_SHOWN = 2;

type Level = "out" | "low";
interface Crossing { id: string; storeId: string; level: Level; name: string }

/** Listings at or below their low-stock threshold that sold in the last month, so dead catalog stays quiet */
async function findCrossings(prisma: PrismaClient): Promise<Crossing[]> {
  const rows = await prisma.$queryRaw<{ id: string; store_id: string; available: number; name: string; variant: string }[]>`
    SELECT sp.id, sp.store_id, sp.stock - sp.reserved_stock AS available, p.name, v.name AS variant
    FROM store_products sp
    JOIN stores s ON s.id = sp.store_id
    JOIN products p ON p.id = sp.product_id
    JOIN product_variants v ON v.id = sp.variant_id
    WHERE sp.is_active AND s.status = 'ACTIVE'
      AND sp.stock - sp.reserved_stock <= COALESCE(sp.low_stock_threshold, ${DEFAULT_LOW_STOCK_THRESHOLD})
      AND EXISTS (
        SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.store_product_id = sp.id AND o.created_at > now() - make_interval(days => ${SOLD_WITHIN_DAYS}::int))`;
  return rows.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    level: r.available <= 0 ? "out" : "low",
    name: r.variant.toLowerCase().startsWith(r.name.toLowerCase()) ? r.variant : `${r.name} ${r.variant}`,
  }));
}

function summarise(items: Crossing[]) {
  const out = items.filter((i) => i.level === "out");
  const ordered = [...out, ...items.filter((i) => i.level === "low")];
  const shown = ordered.slice(0, NAMES_SHOWN).map((i) => i.name).join(", ");
  const more = ordered.length - NAMES_SHOWN;
  const names = more > 0 ? `${shown} and ${more} more` : shown;
  const title = out.length > 0 ? `${plural(out.length, "item")} out of stock` : `${plural(items.length, "item")} running low`;
  return { title, body: names };
}

/** Alerts stock staff once per item, level and day; one notification per store per scan */
export async function scanStockCrossings(fcm: Messaging | null, prisma: PrismaClient) {
  const dateKey = istNow().key;
  const fresh: Crossing[] = [];
  for (const c of await findCrossings(prisma)) {
    if (await alertOnce(prisma, `stock:${c.id}:${c.level}:${dateKey}`)) fresh.push(c);
  }
  const byStore = new Map<string, Crossing[]>();
  for (const c of fresh) byStore.set(c.storeId, [...(byStore.get(c.storeId) ?? []), c]);
  for (const [storeId, items] of byStore) {
    const { title, body } = summarise(items);
    await notifyStaff(fcm, prisma, storeId, { permissions: ["STOCK_RECEIVE", "LISTING_AVAILABILITY"] }, {
      type: "STAFF_STOCK",
      title,
      body,
      data: { screen: "stock", ...(items.length === 1 ? { storeProductId: items[0].id } : {}) },
    });
  }
}

/** A submitted count waits for someone with approval rights; the submitter isn't told */
export async function notifyCountSubmitted(fcm: Messaging | null, prisma: PrismaClient, countId: string, submitterId: string) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId },
    select: {
      storeId: true,
      subcategory: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });
  if (!count) return;
    await notifyStaff(fcm, prisma, count.storeId, { permissions: ["STOCK_APPROVE"], excludeUserId: submitterId }, {
    type: "STAFF_STOCK",
    title: "Count ready for review",
    body: `${count.subcategory.name} · ${plural(count._count.lines, "item")} · by ${count.createdBy.name}`,
    data: { screen: "stock-count", countId },
  });
}

type CountOutcome = "approved" | "rejected" | "recount";

async function outcomeCopy(prisma: PrismaClient, countId: string, outcome: CountOutcome, reviewNote: string | null) {
  if (outcome === "rejected") return { title: "Count rejected", body: reviewNote ?? "The reviewer didn't accept this count." };
  const lines = await prisma.stockCountLine.findMany({ where: { stockCountId: countId }, select: { countedQty: true, systemQty: true, recountRequested: true } });
  if (outcome === "recount") {
    const sent = lines.filter((l) => l.recountRequested).length;
    return { title: `Recount requested · ${plural(sent, "item")} sent back`, body: reviewNote ?? "Count them again and resubmit." };
  }
  const adjustments = lines.filter((l) => l.systemQty !== null && l.systemQty !== l.countedQty).length;
  return { title: `Count approved · ${plural(adjustments, "adjustment")}`, body: reviewNote ?? "Stock has been updated." };
}

/** Tells the counter how their count was reviewed, unless they reviewed it themselves */
export async function notifyCountReviewed(fcm: Messaging | null, prisma: PrismaClient, countId: string, outcome: CountOutcome, reviewerId: string) {
  const count = await prisma.stockCount.findUnique({ where: { id: countId }, select: { storeId: true, createdById: true, reviewNote: true } });
  if (!count || count.createdById === reviewerId) return;
  const copy = await outcomeCopy(prisma, countId, outcome, count.reviewNote);
  await notifyStaff(fcm, prisma, count.storeId, { userIds: [count.createdById] }, {
    type: "STAFF_STOCK",
    ...copy,
    data: { screen: "stock-count", countId },
  });
}
