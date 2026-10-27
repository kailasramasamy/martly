import { STOREFRONT_CHECKS, STOREFRONT_GROUPS, type HomeSectionType, type StorefrontGroup } from "@martly/shared/constants";
import type { StorefrontCheckResult, StorefrontHealth, StorefrontSuggestion } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";
import { getEntitlements } from "../marketing/entitlements.js";
import { STORE_SELECT, type CheckContext } from "./checks/context.js";
import { dealsChecks } from "./checks/deals.js";
import { freshChecks } from "./checks/fresh.js";
import { homeChecks } from "./checks/home.js";
import { looksChecks } from "./checks/looks.js";
import { serviceChecks } from "./checks/service.js";

const DAY_MS = 86_400_000;
const CACHE_MS = 60_000;
const TREND_DAYS = 30;
// Banners shown this often and tapped less than this read as not working
const BANNER_MIN_VIEWS = 200;
const BANNER_MIN_CTR = 0.005;
// When deal rows take this share of Home cart adds, deal suggestions rank higher
const DEALS_SELL_SHARE = 0.25;
const DEALS_BOOST = 1.3;
const DEAL_SECTIONS: HomeSectionType[] = ["BUY_GET_DEALS", "DEALS", "PRICE_BAND_DEALS", "HERO_CARDS"];

const cache = new Map<string, { at: number; value: StorefrontHealth }>();
const today = (now: Date) => new Date(`${istDateKey(now)}T00:00:00Z`);

/** Score out of 100 over the checks that apply, overall and per group */
function scoreOf(checks: StorefrontCheckResult[]) {
  const sum = (list: StorefrontCheckResult[]) => {
    const applies = list.filter((c) => c.status !== "NA");
    const total = applies.reduce((s, c) => s + STOREFRONT_CHECKS[c.key].weight, 0);
    return total ? Math.round((applies.reduce((s, c) => s + STOREFRONT_CHECKS[c.key].weight * c.earned, 0) / total) * 100) : null;
  };
  const groups = Object.fromEntries(STOREFRONT_GROUPS.map((g) => [g, sum(checks.filter((c) => STOREFRONT_CHECKS[c.key].group === g))]));
  return { score: sum(checks) ?? 0, groups: groups as Record<StorefrontGroup, number | null> };
}

// Store-owned banners shoppers see but don't tap
async function bannersUnderperform({ prisma, store, now }: CheckContext) {
  const rows = await prisma.bannerStatDaily.groupBy({
    by: ["bannerId"],
    where: { storeId: store.id, date: { gte: new Date(now.getTime() - 14 * DAY_MS) }, banner: { OR: [{ storeId: store.id }, { organizationId: store.organizationId }] } },
    _sum: { views: true, taps: true },
  });
  return rows.some((r) => (r._sum.views ?? 0) >= BANNER_MIN_VIEWS && (r._sum.taps ?? 0) / (r._sum.views ?? 1) < BANNER_MIN_CTR);
}

async function dealsSell({ prisma, store, now }: CheckContext) {
  const rows = await prisma.homeSectionStatDaily.groupBy({
    by: ["sectionType"], where: { storeId: store.id, date: { gte: new Date(now.getTime() - TREND_DAYS * DAY_MS) } }, _sum: { cartAdds: true },
  });
  const all = rows.reduce((s, r) => s + (r._sum.cartAdds ?? 0), 0);
  const deals = rows.filter((r) => DEAL_SECTIONS.includes(r.sectionType as HomeSectionType)).reduce((s, r) => s + (r._sum.cartAdds ?? 0), 0);
  return all > 0 && deals / all >= DEALS_SELL_SHARE;
}

/** What to do next, biggest gain first: missing or lapsed checks, plus ones that are on but not working */
function suggest(checks: StorefrontCheckResult[], evidence: { dealsSell: boolean }): StorefrontSuggestion[] {
  const total = checks.filter((c) => c.status !== "NA").reduce((s, c) => s + STOREFRONT_CHECKS[c.key].weight, 0) || 1;
  return checks.flatMap((c): StorefrontSuggestion[] => {
    const meta = STOREFRONT_CHECKS[c.key];
    const points = (meta.weight / total) * 100;
    if (c.status === "NA") return [];
    if (c.underperforming) return [{ key: c.key, gain: Math.round(points * 0.5), evidence: "UNDERPERFORMING" }];
    if (c.earned >= 1) return [];
    const boost = evidence.dealsSell && meta.group === "DEALS";
    const gain = Math.round(points * (1 - c.earned) * (boost ? DEALS_BOOST : 1));
    const why = boost ? "DEALS_SELL" : c.key === "FESTIVAL" ? "FESTIVAL_SOON" : undefined;
    return [{ key: c.key, gain, ...(why && { evidence: why }) }];
  }).sort((a, b) => b.gain - a.gain);
}

async function allowance(prisma: PrismaClient, organizationId: string) {
  const e = await getEntitlements(prisma, organizationId);
  return { promotions: e.promotions.planLeft + e.promotions.topUpBalance, aiImages: e.aiImages.left };
}

async function compute(prisma: PrismaClient, storeId: string): Promise<StorefrontHealth> {
  const now = new Date();
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: STORE_SELECT });
  const ctx: CheckContext = { prisma, store, now, resolve: { prisma, store, userId: "", now, shelves: "grid" } };
  const [groups, underperforming, sells, plan, history] = await Promise.all([
    Promise.all([looksChecks(ctx), homeChecks(ctx), dealsChecks(ctx), freshChecks(ctx), serviceChecks(ctx)]),
    bannersUnderperform(ctx),
    dealsSell(ctx),
    allowance(prisma, store.organizationId),
    prisma.storefrontHealthSnapshot.findMany({
      where: { storeId, date: { gte: new Date(now.getTime() - TREND_DAYS * DAY_MS), lt: today(now) } }, orderBy: { date: "asc" },
    }),
  ]);
  const checks = groups.flat().map((c) => (c.key === "BANNERS" && c.status === "ON" && underperforming ? { ...c, underperforming } : c));
  const { score, groups: byGroup } = scoreOf(checks);
  await prisma.storefrontHealthSnapshot.upsert({
    where: { storeId_date: { storeId, date: today(now) } },
    create: { storeId, date: today(now), score, groups: byGroup }, update: { score, groups: byGroup },
  });
  const trend = [...history.map((h) => ({ date: istDateKey(h.date), score: h.score })), { date: istDateKey(now), score }];
  return { storeId, score, groups: byGroup, checks, suggestions: suggest(checks, { dealsSell: sells }), trend, allowance: plan };
}

/** The store's storefront health; recomputed at most once a minute, and recorded as today's snapshot */
export async function storefrontHealth(prisma: PrismaClient, storeId: string, fresh = false) {
  const hit = cache.get(storeId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await compute(prisma, storeId);
  cache.set(storeId, { at: Date.now(), value });
  return value;
}
