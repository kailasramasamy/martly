import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BannerEvent {
  bannerId: string;
  type: "VIEW" | "TAP";
  count: number;
}

// One shopper's batch: the app counts a banner's view once per session and the site once per page, so a batch never
// holds more than one real view of a banner; anything above these is dropped, so prepaid view caps can't be burned
const MAX_VIEWS_PER_BATCH = 1;
const MAX_TAPS_PER_BATCH = 3;

/** Adds a batch of views and taps to today's (IST) counters; events for unknown banners are dropped */
export async function recordBannerEvents(prisma: PrismaClient, storeId: string, events: BannerEvent[]) {
  const totals = new Map<string, { views: number; taps: number }>();
  for (const e of events) {
    const t = totals.get(e.bannerId) ?? { views: 0, taps: 0 };
    if (e.type === "VIEW") t.views = Math.min(t.views + e.count, MAX_VIEWS_PER_BATCH);
    else t.taps = Math.min(t.taps + e.count, MAX_TAPS_PER_BATCH);
    totals.set(e.bannerId, t);
  }
  const [store, known] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { id: true } }),
    prisma.banner.findMany({ where: { id: { in: [...totals.keys()] } }, select: { id: true } }),
  ]);
  if (!store) return 0;
  const date = new Date(`${istDateKey(new Date())}T00:00:00Z`);
  await prisma.$transaction(known.flatMap(({ id }) => {
    const { views, taps } = totals.get(id)!;
    return [
      prisma.bannerStatDaily.upsert({
        where: { bannerId_storeId_date: { bannerId: id, storeId, date } },
        create: { bannerId: id, storeId, date, views, taps },
        update: { views: { increment: views }, taps: { increment: taps } },
      }),
      // Prepaid-view campaigns stop serving once this reaches their cap
      ...(views ? [prisma.banner.update({ where: { id }, data: { viewsServed: { increment: views } } })] : []),
    ];
  }));
  return known.length;
}

const ctr = (views: number, taps: number) => (views ? Math.round((taps / views) * 1000) / 10 : 0);

/** Views, taps and tap rate per banner over the last `days` days, for the banners matching `where` */
export async function bannerResults(prisma: PrismaClient, where: Prisma.BannerWhereInput, days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const banners = await prisma.banner.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, title: true, imageUrl: true, placement: true, sponsorType: true, isActive: true, startsAt: true, endsAt: true, promo: { select: { id: true } } },
  });
  const sums = await prisma.bannerStatDaily.groupBy({
    by: ["bannerId"], where: { bannerId: { in: banners.map((b) => b.id) }, date: { gte: since } }, _sum: { views: true, taps: true },
  });
  const byId = new Map(sums.map((s) => [s.bannerId, { views: s._sum.views ?? 0, taps: s._sum.taps ?? 0 }]));
  return banners.map(({ promo, ...b }) => {
    const { views, taps } = byId.get(b.id) ?? { views: 0, taps: 0 };
    return { ...b, promoId: promo?.id ?? null, views, taps, ctr: ctr(views, taps) };
  });
}

/** The "sales boost" of a promo: orders and revenue on its products in its stores while it ran */
export async function promoSales(prisma: PrismaClient, promo: { organizationId: string; collectionId: string | null; startsAt: Date | null; endsAt: Date | null }) {
  if (!promo.collectionId || !promo.startsAt) return { orders: 0, units: 0, revenue: 0 };
  const until = promo.endsAt && promo.endsAt < new Date() ? promo.endsAt : new Date();
  const [row] = await prisma.$queryRaw<{ orders: bigint; units: bigint | null; revenue: Prisma.Decimal | null }[]>`
    SELECT COUNT(DISTINCT o.id) AS orders, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN stores s ON s.id = o.store_id
    WHERE s.organization_id = ${promo.organizationId}
      AND oi.product_id IN (SELECT product_id FROM collection_items WHERE collection_id = ${promo.collectionId})
      AND o.created_at BETWEEN ${promo.startsAt} AND ${until}
      AND o.status <> 'CANCELLED'`;
  return { orders: Number(row?.orders ?? 0), units: Number(row?.units ?? 0), revenue: Number(row?.revenue ?? 0) };
}
