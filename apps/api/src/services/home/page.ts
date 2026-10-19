import { HOME_SECTIONS_PAGE_SIZE } from "@martly/shared/constants";
import type { HomeChrome, HomeSectionsPage } from "@martly/shared/types";
import { reviewSummaries, withReviews } from "../store-feed.js";
import { storeBanners } from "../marketing/banner-feed.js";
import { expandLayout, loadLayout } from "./layout.js";
import { RESOLVERS } from "./registry.js";
import type { LayoutEntry, ResolveContext, ResolvedSection } from "./types.js";

export type PageStore = { id: string; organizationId: string; freeDeliveryThreshold: unknown };

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return 0;
  try {
    const { i } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Number.isInteger(i) && i >= 0) return i as number;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
  }
  throw Object.assign(new Error("Invalid cursor"), { statusCode: 400 });
}

const encodeCursor = (i: number) => Buffer.from(JSON.stringify({ i })).toString("base64url");

// Every product list a section carries, so reviews are looked up once for the whole page
function mapProductLists(section: ResolvedSection, fn: (items: any[]) => any[]): ResolvedSection {
  const data = (section as { data?: Record<string, any> }).data;
  if ("products" in section) return { ...section, products: fn(section.products) } as ResolvedSection;
  if (section.type === "CAMPAIGN_CARD") return { ...section, highlights: fn(section.highlights) };
  if (data?.products) return { ...section, data: { ...data, products: fn(data.products) } } as ResolvedSection;
  if (data?.categories) {
    return { ...section, data: { ...data, categories: data.categories.map((c: any) => ({ ...c, products: fn(c.products) })) } } as ResolvedSection;
  }
  return section;
}

async function withPageReviews(ctx: ResolveContext, sections: ResolvedSection[]) {
  const ids: string[] = [];
  sections.forEach((s) => mapProductLists(s, (items) => (ids.push(...items.map((p) => p.productId as string)), items)));
  const reviews = await reviewSummaries(ctx.prisma, ids);
  return sections.map((s) => mapProductLists(s, (items) => withReviews(items, reviews)));
}

async function pageChrome(ctx: ResolveContext, store: PageStore, sections: ResolvedSection[]): Promise<HomeChrome> {
  const lead = sections[0] as { type: string; data?: { hero?: { theme: HomeChrome["headerTheme"] } } } | undefined;
  const [membership, popups] = await Promise.all([
    ctx.userId
      ? ctx.prisma.userMembership.findFirst({
          where: { userId: ctx.userId, organizationId: store.organizationId, status: "ACTIVE", endDate: { gte: ctx.now }, plan: { freeDelivery: true } },
          select: { id: true },
        })
      : null,
    storeBanners(ctx.prisma, store, ["POPUP"]),
  ]);
  return {
    headerTheme: lead?.type === "FESTIVE_HERO" ? lead.data?.hero?.theme ?? null : null,
    searchHints: [],
    freeDeliveryThreshold: store.freeDeliveryThreshold === null || membership ? null : Number(store.freeDeliveryThreshold),
    popup: (popups[0] as Record<string, unknown> | undefined) ?? null,
  };
}

/** Resolves a layout entry list's slice, dropping sections the store has nothing for. */
async function resolveSlice(ctx: ResolveContext, entries: LayoutEntry[]) {
  const resolved = await Promise.all(entries.map((entry) => RESOLVERS[entry.type](ctx, entry)));
  return resolved.filter((s): s is ResolvedSection => s !== null);
}

/** One page of Home sections for a store; the first page also carries the page-level chrome. */
export async function homeSectionsPage(
  prisma: ResolveContext["prisma"], store: PageStore, userId: string, cursor: string | undefined,
): Promise<HomeSectionsPage> {
  const ctx: ResolveContext = { prisma, store, userId, now: new Date() };
  const entries = await expandLayout(ctx, await loadLayout(ctx));
  let start = decodeCursor(cursor);
  let sections: ResolvedSection[] = [];
  let end = start;
  while (end < entries.length && sections.length === 0) {
    end = Math.min(start + HOME_SECTIONS_PAGE_SIZE, entries.length);
    sections = await resolveSlice(ctx, entries.slice(start, end));
    start = end;
  }
  const reviewed = await withPageReviews(ctx, sections);
  return {
    sections: reviewed,
    nextCursor: end < entries.length ? encodeCursor(end) : null,
    ...(cursor ? {} : { chrome: await pageChrome(ctx, store, reviewed) }),
  };
}
