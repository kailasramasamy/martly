import type { Prisma } from "../../../generated/prisma/client.js";
import { promoOfferLabel } from "./campaign-look.js";
import { liveWindow } from "../store-feed.js";
import { DEFAULT_LAYOUT } from "./default-layout.js";
import { festiveHeroesFor } from "./resolvers/system.js";
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
    select: { id: true, title: true, subtitle: true, translations: true, promo: { select: { discountType: true, discountValue: true } } },
  });
  return collections.map((c) => ({
    id: `campaign-${c.id}`, type: "CAMPAIGN_CARD", title: c.title, subtitle: c.subtitle, translations: c.translations,
    collectionId: c.id, config: { offerLabel: promoOfferLabel(c.promo) ?? undefined }, items: [],
  }));
}

// A plain product row for every live collection no section already shows, so new collections appear without layout edits
async function otherCollections(ctx: ResolveContext, placed: Set<string>): Promise<LayoutEntry[]> {
  const collections = await ctx.prisma.collection.findMany({
    where: {
      isActive: true, kind: { not: "PROMO" }, id: { notIn: [...placed] },
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

/** With no festival to show, the hero banner carousel takes the empty top slot instead of waiting further down */
function bannersIntoHeroSlot(layout: LayoutEntry[]) {
  const hero = layout.findIndex((e) => e.type === "FESTIVE_HERO");
  const banners = layout.findIndex((e) => e.type === "HERO_BANNERS");
  if (hero === -1 || banners === -1) return layout;
  const rest = layout.filter((_, i) => i !== hero && i !== banners);
  const at = banners < hero ? hero - 1 : hero;
  return [...rest.slice(0, at), layout[banners], ...rest.slice(at)];
}

/** The layout as the app sees it: automatic sections replaced by the cards and rows they stand for. */
export async function expandLayout(ctx: ResolveContext, saved: LayoutEntry[]): Promise<LayoutEntry[]> {
  // Festivals in the hero carousel are placed; ones it has no room for fall through to plain rows
  const heroEntry = saved.find((e) => e.type === "FESTIVE_HERO");
  const heroes = heroEntry ? await festiveHeroesFor(ctx, heroEntry) : [];
  const layout = heroEntry && heroes.length === 0 ? bannersIntoHeroSlot(saved) : saved;
  const placed = new Set([
    ...heroes.map((h) => h.id),
    ...layout.flatMap((e) => [e.collectionId, ...e.items.map((i) => i.collectionId)]).filter((id): id is string => !!id),
  ]);
  const expanded = await Promise.all(layout.map((entry) => {
    if (entry.type === "LIVE_CAMPAIGNS") return liveCampaigns(ctx, placed);
    if (entry.type === "OTHER_COLLECTIONS") return otherCollections(ctx, placed);
    return [entry];
  }));
  return expanded.flat();
}
