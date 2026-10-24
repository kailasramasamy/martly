import { HOME_SECTIONS_PAGE_SIZE } from "@martly/shared/constants";
import type { HomeChrome, HomeSectionsPage } from "@martly/shared/types";
import { reviewSummaries, withAllSizes, withReviews } from "../store-feed.js";
import { dominantCategory, injectAd, liveSponsored, pickAd } from "../sponsored.js";
import { expandLayout, loadLayout } from "./layout.js";
import { RESOLVERS } from "./registry.js";
import { searchHints } from "./search-hints.js";
import type { LayoutEntry, ResolveContext, ResolvedSection } from "./types.js";

const FESTIVAL_HINTS = 2;

export type PageStore = { id: string; organizationId: string; freeDeliveryThreshold: unknown };

// Where the next page starts, and the sponsored products earlier pages already showed (each appears once per scroll)
type Cursor = { i: number; ads: string[] };

function decodeCursor(cursor: string | undefined): Cursor {
  if (!cursor) return { i: 0, ads: [] };
  try {
    const { i, ads } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Number.isInteger(i) && i >= 0) return { i, ads: Array.isArray(ads) ? ads.filter((a): a is string => typeof a === "string") : [] };
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
  }
  throw Object.assign(new Error("Invalid cursor"), { statusCode: 400 });
}

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");

// The first `count` products of a list of size rows, every size of each kept
function firstProducts<T extends { productId: string }>(rows: T[], count: number) {
  const kept = new Set<string>();
  return rows.filter((r) => (kept.has(r.productId) || (kept.size < count && kept.add(r.productId))));
}

/** A product row or tabbed row takes the ad for the category most of its products are in, second in line; a product
 *  row is a grid of whole rows, so the ad takes a slot rather than adding one */
async function withSponsored(ctx: ResolveContext, sections: ResolvedSection[], shown: Set<string>) {
  const ads = await liveSponsored(ctx.prisma, ctx.store);
  if (ads.length === 0) return sections;
  const out: ResolvedSection[] = [];
  for (const section of sections) {
    const products = section.type === "PRODUCT_ROW" || section.type === "TABBED_ROW" ? section.products : [];
    const category = products.length > 0 ? dominantCategory(products) : null;
    const ad = category ? pickAd(ads, new Set([category]), shown) : null;
    if (!ad) {
      out.push(section);
      continue;
    }
    shown.add(ad.bannerId);
    const adRows = await withAllSizes(ctx.prisma, ctx.store.id, [{ productId: ad.productId }]);
    const injected = injectAd(products, adRows, ad);
    const shelf = section.type === "PRODUCT_ROW" ? firstProducts(injected, new Set(products.map((p) => p.productId)).size) : injected;
    out.push({ ...section, products: shelf } as ResolvedSection);
  }
  return out;
}

// Every product list a section carries, so reviews are looked up once for the whole page
function mapProductLists(section: ResolvedSection, fn: (items: any[]) => any[]): ResolvedSection {
  const data = (section as { data?: Record<string, any> }).data;
  if ("products" in section) return { ...section, products: fn(section.products) } as ResolvedSection;
  if (section.type === "CAMPAIGN_CARD") return { ...section, highlights: fn(section.highlights) };
  if (section.type === "STORE_SPECIALS") return { ...section, collections: section.collections.map((c) => ({ ...c, products: fn(c.products) })) };
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
  const lead = sections[0] as { type: string; data?: { hero?: { theme: HomeChrome["headerTheme"]; tiles: { title: string }[] } } } | undefined;
  const hero = lead?.type === "FESTIVE_HERO" ? lead.data?.hero : undefined;
  const [membership, hints] = await Promise.all([
    ctx.userId
      ? ctx.prisma.userMembership.findFirst({
          where: { userId: ctx.userId, organizationId: store.organizationId, status: "ACTIVE", endDate: { gte: ctx.now }, plan: { freeDelivery: true } },
          select: { id: true },
        })
      : null,
    // The live festival's first aisles lead the rotation
    searchHints(ctx.prisma, store.id, (hero?.tiles ?? []).slice(0, FESTIVAL_HINTS).map((t) => t.title), ctx.now),
  ]);
  return {
    headerTheme: hero?.theme ?? null,
    searchHints: hints,
    freeDeliveryThreshold: store.freeDeliveryThreshold === null || membership ? null : Number(store.freeDeliveryThreshold),
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
  const position = decodeCursor(cursor);
  let start = position.i;
  let sections: ResolvedSection[] = [];
  let end = start;
  while (end < entries.length && sections.length === 0) {
    end = Math.min(start + HOME_SECTIONS_PAGE_SIZE, entries.length);
    sections = await resolveSlice(ctx, entries.slice(start, end));
    start = end;
  }
  const shown = new Set(position.ads);
  const reviewed = await withPageReviews(ctx, await withSponsored(ctx, sections, shown));
  return {
    sections: reviewed,
    nextCursor: end < entries.length ? encodeCursor({ i: end, ads: [...shown] }) : null,
    ...(cursor ? {} : { chrome: await pageChrome(ctx, store, reviewed) }),
  };
}
