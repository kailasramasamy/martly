import type { Prisma } from "../../../generated/prisma/client.js";
import { promoOfferLabel } from "./campaign-look.js";
import { liveWindow } from "../store-feed.js";
import { DEFAULT_LAYOUT } from "./default-layout.js";
import { festiveHeroesFor } from "./resolvers/system.js";
import { rankedFestivals } from "../festive-hero.js";
import type { LayoutEntry, ResolveContext } from "./types.js";

export const SECTION_INCLUDE = { items: { orderBy: { sortOrder: "asc" } } } satisfies Prisma.HomeSectionInclude;

type SavedSection = Prisma.HomeSectionGetPayload<{ include: typeof SECTION_INCLUDE }>;

export function toEntry(section: SavedSection): LayoutEntry {
  return {
    id: section.id, type: section.type, title: section.title, subtitle: section.subtitle, translations: section.translations,
    collectionId: section.collectionId, config: (section.config ?? {}) as Record<string, unknown>,
    items: section.items.map(({ id, label, translations, imageUrl, collectionId, subcategoryIds, wide }) => (
      { id, label, translations, imageUrl, collectionId, subcategoryIds, wide }
    )),
  };
}

/** The organisation's active saved sections in order, or the built-in default when it has saved none. */
export async function loadLayout(ctx: Pick<ResolveContext, "prisma" | "store">): Promise<LayoutEntry[]> {
  const rows = await ctx.prisma.homeSection.findMany({
    where: { organizationId: ctx.store.organizationId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: SECTION_INCLUDE,
  });
  if (rows.length === 0) return DEFAULT_LAYOUT;
  return rows.filter((r) => r.isActive).map(toEntry);
}

function orgOrGlobal(organizationId: string) {
  return [{ organizationId }, { organizationId: null }];
}


// One campaign card per live promo collection that no section already shows (an admin may have placed it themselves)
async function liveCampaigns(ctx: ResolveContext, placed: Set<string>): Promise<LayoutEntry[]> {
  const collections = await ctx.prisma.collection.findMany({
    where: {
      isActive: true, kind: "PROMO", id: { notIn: [...placed] },
      OR: orgOrGlobal(ctx.store.organizationId), AND: liveWindow(ctx.now),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true, title: true, subtitle: true, translations: true, promo: { select: { discountType: true, discountValue: true, chargedFrom: true } },
    },
  });
  return collections.map((c) => ({
    id: `campaign-${c.id}`, type: "CAMPAIGN_CARD", title: c.title, subtitle: c.subtitle, translations: c.translations,
    collectionId: c.id, config: { offerLabel: promoOfferLabel(c.promo) ?? undefined }, items: [], cardLead: c.promo?.chargedFrom === "BRAND" ? "BRAND" : undefined,
  }));
}

// A plain product row for every live collection no section already shows, so new collections appear without layout edits
async function otherCollections(ctx: ResolveContext, placed: Set<string>): Promise<LayoutEntry[]> {
  const collections = await ctx.prisma.collection.findMany({
    where: {
      // Store specials show as their own cards (STORE_SPECIALS), never also as a plain shelf
      isActive: true, kind: { notIn: ["PROMO", "STORE_SPECIAL"] }, id: { notIn: [...placed] },
      OR: orgOrGlobal(ctx.store.organizationId), AND: liveWindow(ctx.now),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, title: true, subtitle: true, translations: true },
  });
  return collections.map((c) => ({
    id: `collection-${c.id}`, type: "PRODUCT_ROW", title: c.title, subtitle: c.subtitle, translations: c.translations,
    collectionId: c.id, config: {}, items: [],
  }));
}

/**
 * The hero banner carousel carries paid brand banners, so it always shows in the first screens, wherever a saved layout
 * put it and even if the layout left it out: right after the department grid (or the category directory), so shoppers
 * can browse before the ads, or right under the festive top (leading the page without one) when the layout has neither.
 */
function pinHeroBanners(layout: LayoutEntry[]) {
  const banners = layout.find((e) => e.type === "HERO_BANNERS") ?? DEFAULT_LAYOUT.find((e) => e.type === "HERO_BANNERS")!;
  const rest = layout.filter((e) => e.type !== "HERO_BANNERS");
  const directory = rest.findIndex((e) => e.type === "DEPARTMENT_GRID" || e.type === "CATEGORY_DIRECTORY");
  const at = (directory >= 0 ? directory : rest.findIndex((e) => e.type === "FESTIVE_HERO")) + 1;
  return [...rest.slice(0, at), banners, ...rest.slice(at)];
}

// Live festivals the single hero has no room for get a campaign card each, unless a section already shows them
async function festivalCards(ctx: ResolveContext, heroIds: string[], layout: LayoutEntry[]): Promise<LayoutEntry[]> {
  const shown = new Set([...heroIds, ...layout.map((e) => e.collectionId).filter((id): id is string => !!id)]);
  const festivals = await rankedFestivals(ctx.prisma, ctx.store.organizationId, ctx.now);
  return festivals.filter((f) => !shown.has(f.id)).map((f) => ({
    id: `festival-${f.id}`, type: "CAMPAIGN_CARD", title: f.heroTitle ?? f.title, subtitle: f.heroSubtitle ?? f.subtitle,
    translations: f.translations, collectionId: f.id, config: {}, items: [], cardLead: "FESTIVAL",
  }));
}

const CARD_LEAD_ORDER = { BRAND: 0, FESTIVAL: 1 } as const;
const leadRank = (e: LayoutEntry) => (e.cardLead ? CARD_LEAD_ORDER[e.cardLead] : 2);

// Product rows that space campaign cards apart: collection-backed, so they reliably have products to show
const SPACER_TYPES = new Set(["PRODUCT_ROW", "TABBED_ROW"]);
const MAX_ROWS_BETWEEN_CARDS = 2;

/**
 * Campaign cards stacked together read as a wall of ads and push products down, so they're spread through the product
 * rows: brand-paid cards first, then festivals, the first card after the first row, then every two rows (closer when
 * cards outnumber rows). Cards beyond the last row follow it.
 */
function interleaveCampaignCards(layout: LayoutEntry[]) {
  const cards = layout.filter((e) => e.type === "CAMPAIGN_CARD").sort((a, b) => leadRank(a) - leadRank(b));
  const rest = layout.filter((e) => e.type !== "CAMPAIGN_CARD");
  const rows = rest.filter((e) => SPACER_TYPES.has(e.type)).length;
  if (cards.length < 2 || rows === 0) return layout;
  const gap = Math.min(MAX_ROWS_BETWEEN_CARDS, Math.max(1, Math.floor((rows - 1) / (cards.length - 1))));
  const out: LayoutEntry[] = [];
  let rowsSeen = 0;
  for (const entry of rest) {
    out.push(entry);
    if (!SPACER_TYPES.has(entry.type)) continue;
    rowsSeen++;
    const due = (rowsSeen - 1) % gap === 0 || rowsSeen === rows;
    if (due) out.push(...cards.splice(0, rowsSeen === rows ? cards.length : 1));
  }
  return out;
}

/** The layout as the app sees it: automatic sections replaced by the cards and rows they stand for. */
export async function expandLayout(ctx: ResolveContext, saved: LayoutEntry[]): Promise<LayoutEntry[]> {
  // Festivals in the festive hero or the hero cards are placed; ones they have no room for fall through to plain rows
  const heroEntry = saved.find((e) => e.type === "FESTIVE_HERO" || e.type === "HERO_CARDS");
  const heroes = heroEntry ? await festiveHeroesFor(ctx) : [];
  const layout = pinHeroBanners(saved);
  const festivals = await festivalCards(ctx, heroes.map((h) => h.id), layout);
  const placed = new Set([
    ...heroes.map((h) => h.id),
    ...festivals.map((f) => f.collectionId!),
    ...layout.flatMap((e) => [e.collectionId, ...e.items.map((i) => i.collectionId)]).filter((id): id is string => !!id),
  ]);
  const expanded = await Promise.all(layout.map((entry) => {
    if (entry.type === "LIVE_CAMPAIGNS") return liveCampaigns(ctx, placed);
    if (entry.type === "OTHER_COLLECTIONS") return otherCollections(ctx, placed);
    return [entry];
  }));
  return interleaveCampaignCards([...expanded.flat(), ...festivals]);
}
