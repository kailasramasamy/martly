import { Prisma, type BrandCampaign, type PrismaClient } from "../../../generated/prisma/client.js";

const ctr = (views: number, taps: number) => (views ? Math.round((taps / views) * 1000) / 10 : 0);

/** Every banner the campaign ran: its network banner, or each organisation's promo banner */
async function campaignBannerIds(prisma: PrismaClient, campaignId: string) {
  const banners = await prisma.banner.findMany({
    where: { OR: [{ brandCampaignId: campaignId }, { promo: { brandCampaignId: campaignId } }] }, select: { id: true },
  });
  return banners.map((b) => b.id);
}

/** Views, taps and brand sales per store while the campaign ran */
export async function campaignResults(prisma: PrismaClient, campaign: BrandCampaign) {
  const bannerIds = await campaignBannerIds(prisma, campaign.id);
  const perStore = await prisma.bannerStatDaily.groupBy({ by: ["storeId"], where: { bannerId: { in: bannerIds } }, _sum: { views: true, taps: true } });
  const storeIds = perStore.map((s) => s.storeId);
  const until = campaign.endsAt < new Date() ? campaign.endsAt : new Date();
  const [stores, sales] = await Promise.all([
    prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } }),
    storeIds.length
      ? prisma.$queryRaw<{ store_id: string; orders: bigint; units: bigint | null; revenue: Prisma.Decimal | null }[]>`
          SELECT o.store_id, COUNT(DISTINCT o.id) AS orders, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
          FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
          WHERE p.brand_id = ${campaign.brandId} AND o.store_id IN (${Prisma.join(storeIds)})
            AND o.created_at BETWEEN ${campaign.startsAt} AND ${until} AND o.status <> 'CANCELLED'
          GROUP BY o.store_id`
      : Promise.resolve([]),
  ]);
  const names = new Map(stores.map((s) => [s.id, s.name]));
  const bySales = new Map(sales.map((s) => [s.store_id, s]));
  const rows = perStore.map((s) => {
    const views = s._sum.views ?? 0, taps = s._sum.taps ?? 0, sale = bySales.get(s.storeId);
    return { storeId: s.storeId, store: names.get(s.storeId) ?? "", views, taps, ctr: ctr(views, taps), orders: Number(sale?.orders ?? 0), units: Number(sale?.units ?? 0), revenue: Number(sale?.revenue ?? 0) };
  });
  const total = rows.reduce((t, r) => ({ views: t.views + r.views, taps: t.taps + r.taps, orders: t.orders + r.orders, units: t.units + r.units, revenue: t.revenue + r.revenue }), { views: 0, taps: 0, orders: 0, units: 0, revenue: 0 });
  return { stores: rows.sort((a, b) => b.views - a.views), total: { ...total, ctr: ctr(total.views, total.taps) } };
}

const csvCell = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);

/**
 * The brand's reimbursement claims for a brand promotion: per store, the units sold at the promo price and the
 * discount the store gave on them (list price minus price paid), for the brand to settle with each store.
 */
export async function claimsCsv(prisma: PrismaClient, campaign: BrandCampaign) {
  const rows = await prisma.$queryRaw<{ store: string; organization: string; units: bigint; discount: Prisma.Decimal }[]>`
    SELECT s.name AS store, org.name AS organization, SUM(oi.quantity) AS units,
           SUM((oi.original_price - oi.unit_price) * oi.quantity) AS discount
    FROM promos pr
    JOIN collection_items ci ON ci.collection_id = pr.collection_id
    JOIN stores s ON s.organization_id = pr.organization_id
    JOIN organizations org ON org.id = pr.organization_id
    JOIN orders o ON o.store_id = s.id AND o.status <> 'CANCELLED' AND o.created_at BETWEEN pr.starts_at AND COALESCE(pr.ends_at, NOW())
    JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = ci.product_id AND oi.original_price > oi.unit_price
    WHERE pr.brand_campaign_id = ${campaign.id} AND pr.starts_at IS NOT NULL
    GROUP BY s.name, org.name
    ORDER BY org.name, s.name`;
  const lines = rows.map((r) => [r.organization, r.store, Number(r.units), Number(r.discount).toFixed(2)].map(csvCell).join(","));
  return ["Organisation,Store,Units sold on offer,Discount given (INR)", ...lines].join("\n");
}
