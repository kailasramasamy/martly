import { STOREFRONT_MIN, type HomeSectionType } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { loadLayout } from "../../home/layout.js";
import { heroCardReadiness } from "../../home/resolvers/hero-cards.js";
import { sectionVisibility } from "../../home/visibility.js";
import { storeSpecials } from "../../search-landing.js";
import { liveFrom, matchesRegions } from "../../seasonal/due-events.js";
import { flag, fromCount, liveWindow, notApplicable, type CheckContext } from "./context.js";

const DAY_MS = 86_400_000;

// Sections that depend on the shopper (their orders, list or membership) or are judged on their own
const NOT_JUDGED = new Set<HomeSectionType>([
  "BUY_AGAIN", "MONTHLY_LIST", "RECENTLY_VIEWED", "MEMBER_CHIPS", "PLUS_PROMO", "BRAND_RAIL", "PERSONALISED",
  "LIVE_CAMPAIGNS", "OTHER_COLLECTIONS", "HERO_CARDS",
]);

async function heroCheck(ctx: CheckContext, layout: Awaited<ReturnType<typeof loadLayout>>): Promise<StorefrontCheckResult> {
  const entry = layout.find((e) => e.type === "HERO_CARDS");
  if (!entry) return { ...fromCount("HERO_CARDS", 0, STOREFRONT_MIN.HERO_CARDS), cards: [] };
  const cards = await heroCardReadiness(ctx.resolve, entry);
  return { ...fromCount("HERO_CARDS", cards.filter((c) => c.ready).length, STOREFRONT_MIN.HERO_CARDS), cards };
}

// The store's own banners running now (Martly's and brands' don't count towards the store's work)
async function bannerCheck({ prisma, store, now }: CheckContext) {
  const own = await prisma.banner.count({
    where: {
      isActive: true, ...liveWindow(now, "startsAt", "endsAt"),
      OR: [{ storeId: store.id }, { storeId: null, organizationId: store.organizationId }],
    },
  });
  return fromCount("BANNERS", own, STOREFRONT_MIN.BANNERS);
}

// A collection for the next festival in the org's regions, once its offers are within reach
async function festivalCheck({ prisma, store, now }: CheckContext): Promise<StorefrontCheckResult> {
  const [org, events] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: store.organizationId }, select: { festivalRegions: true } }),
    prisma.festivalEvent.findMany({
      where: { isActive: true, endsAt: { gt: now } },
      select: { id: true, startsAt: true, leadDays: true, regions: true, collections: { where: { organizationId: store.organizationId, isActive: true }, select: { id: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const soon = events.find((e) => matchesRegions(e, org) && liveFrom(e).getTime() - now.getTime() <= STOREFRONT_MIN.FESTIVAL_AHEAD_DAYS * DAY_MS);
  return soon ? flag("FESTIVAL", soon.collections.length > 0) : notApplicable("FESTIVAL");
}

/** Hero cards, banners, specials, the coming festival, and how much of the saved layout shows */
export async function homeChecks(ctx: CheckContext) {
  const layout = await loadLayout(ctx.resolve);
  const judged = layout.filter((e) => !NOT_JUDGED.has(e.type));
  const [hero, banners, specials, festival, visible] = await Promise.all([
    heroCheck(ctx, layout),
    bannerCheck(ctx),
    storeSpecials(ctx.prisma, ctx.store.id, ctx.store.organizationId, 1),
    festivalCheck(ctx),
    sectionVisibility(ctx.resolve, judged),
  ]);
  return [
    hero,
    banners,
    flag("STORE_SPECIALS", specials.length > 0),
    festival,
    judged.length ? fromCount("SECTIONS_SHOWING", visible.filter((v) => v.resolves).length, judged.length) : notApplicable("SECTIONS_SHOWING"),
  ];
}
