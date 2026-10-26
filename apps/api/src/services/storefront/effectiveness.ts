import { HomeSectionTypeLabels, type HomeSectionType } from "@martly/shared/constants";
import type { OfferEffect, SectionEffect, StorefrontEffectiveness } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";
import { loadLayout } from "../home/layout.js";

const DAY_MS = 86_400_000;

const ctr = (views: number, taps: number) => (views ? Math.round((taps / views) * 1000) / 10 : 0);
const money = (v: unknown) => Math.round(Number(v ?? 0));

type SalesRow = { section_id: string; orders: bigint; revenue: unknown };
type OfferRow = { kind: "BUY_GET" | "DISCOUNT"; orders: bigint; units: bigint; revenue: unknown };

// Orders that went ahead (not cancelled) at the store since `since`
async function sectionSales(prisma: PrismaClient, storeId: string, since: Date) {
  const rows = await prisma.$queryRaw<SalesRow[]>`
    SELECT oi.source_section_id AS section_id, COUNT(DISTINCT o.id) AS orders, SUM(oi.total_price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.created_at >= ${since} AND o.status <> 'CANCELLED' AND oi.source_section_id IS NOT NULL
    GROUP BY oi.source_section_id`;
  return new Map(rows.map((r) => [r.section_id, { orders: Number(r.orders), revenue: money(r.revenue) }]));
}

async function offerSales(prisma: PrismaClient, storeId: string, since: Date) {
  const rows = await prisma.$queryRaw<OfferRow[]>`
    SELECT CASE WHEN oi.free_quantity > 0 THEN 'BUY_GET' ELSE 'DISCOUNT' END AS kind,
      COUNT(DISTINCT o.id) AS orders, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.created_at >= ${since} AND o.status <> 'CANCELLED'
      AND (oi.free_quantity > 0 OR oi.discount_type IS NOT NULL)
    GROUP BY 1`;
  const of = (kind: OfferRow["kind"]): OfferEffect => {
    const r = rows.find((x) => x.kind === kind);
    return { orders: Number(r?.orders ?? 0), units: Number(r?.units ?? 0), revenue: money(r?.revenue) };
  };
  return { buyGet: of("BUY_GET"), discount: of("DISCOUNT") };
}

async function sectionEffects(prisma: PrismaClient, store: { id: string; organizationId: string }, since: Date): Promise<SectionEffect[]> {
  const [stats, sales, layout] = await Promise.all([
    prisma.homeSectionStatDaily.groupBy({
      by: ["sectionId", "sectionType"],
      where: { storeId: store.id, date: { gte: new Date(`${istDateKey(since)}T00:00:00Z`) } },
      _sum: { views: true, taps: true, cartAdds: true },
    }),
    sectionSales(prisma, store.id, since),
    loadLayout({ prisma, store }),
  ]);
  const titles = new Map(layout.map((e) => [e.id, e.title]));
  return stats.map((s) => {
    const views = s._sum.views ?? 0;
    const taps = s._sum.taps ?? 0;
    const sold = sales.get(s.sectionId) ?? { orders: 0, revenue: 0 };
    return {
      sectionId: s.sectionId, sectionType: s.sectionType,
      title: titles.get(s.sectionId) ?? HomeSectionTypeLabels[s.sectionType as HomeSectionType] ?? null,
      views, taps, cartAdds: s._sum.cartAdds ?? 0, ...sold,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.taps - a.taps);
}

async function bannerEffects(prisma: PrismaClient, storeId: string, since: Date) {
  const stats = await prisma.bannerStatDaily.groupBy({
    by: ["bannerId"], where: { storeId, date: { gte: new Date(`${istDateKey(since)}T00:00:00Z`) } }, _sum: { views: true, taps: true },
  });
  const banners = await prisma.banner.findMany({ where: { id: { in: stats.map((s) => s.bannerId) } }, select: { id: true, title: true } });
  const titles = new Map(banners.map((b) => [b.id, b.title]));
  return stats.map((s) => ({
    bannerId: s.bannerId, title: titles.get(s.bannerId) ?? null,
    views: s._sum.views ?? 0, taps: s._sum.taps ?? 0, ctr: ctr(s._sum.views ?? 0, s._sum.taps ?? 0),
  })).sort((a, b) => b.taps - a.taps);
}

/** What shoppers did with the storefront over the last `days`: Home sections, offers, coupons and banners */
export async function storefrontEffectiveness(prisma: PrismaClient, store: { id: string; organizationId: string }, days: number): Promise<StorefrontEffectiveness> {
  const since = new Date(Date.now() - days * DAY_MS);
  const orders = { storeId: store.id, createdAt: { gte: since }, status: { not: "CANCELLED" as const } };
  const [sections, offers, banners, totals, coupons] = await Promise.all([
    sectionEffects(prisma, store, since),
    offerSales(prisma, store.id, since),
    bannerEffects(prisma, store.id, since),
    prisma.order.aggregate({ where: orders, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { ...orders, couponId: { not: null } }, _count: true, _sum: { couponDiscount: true } }),
  ]);
  const revenue = money(totals._sum.totalAmount);
  const fromHome = sections.reduce((sum, s) => sum + s.revenue, 0);
  return {
    storeId: store.id, days, sections, banners, revenue,
    offers: { ...offers, coupons: { redemptions: coupons._count, discount: money(coupons._sum.couponDiscount) } },
    homeRevenueShare: revenue ? Math.round((fromHome / revenue) * 100) : 0,
  };
}
