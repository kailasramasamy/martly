import type { WebShopQuery } from "@martly/shared/schemas";
import type { WebSearchCard, WebSearchFacets, WebSearchLanding, WebSearchPage, WebSuggestion } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildSearchLanding } from "../search-landing.js";
import { suggestSearches } from "../search-suggest.js";
import { searchStoreProducts, type SearchFacets } from "../store-search.js";
import { cardsById, type ShopContext } from "./cards.js";
import { linkBook } from "./links.js";

type Listing = { productId: string; sponsored?: { bannerId: string } };

const storeRef = (ctx: ShopContext) => ({ id: ctx.store.id, organizationId: ctx.organizationId });

/** Each product once, in result order, with the banner of an ad slot it fills */
function productOrder(rows: Listing[]) {
  const ads = new Map<string, string | undefined>();
  for (const r of rows) if (!ads.has(r.productId)) ads.set(r.productId, r.sponsored?.bannerId);
  return ads;
}

/** The app's tab rule: aisles when the matches span two or more, else tags when there are two or more, else none */
async function webFacets(prisma: PrismaClient, f: SearchFacets): Promise<WebSearchFacets> {
  const bySubs = f.subcategories.length >= 2;
  const [subs, brands] = await Promise.all([
    bySubs ? prisma.subcategory.findMany({ where: { id: { in: f.subcategories.map((s) => s.id) } }, select: { id: true, slug: true } }) : [],
    prisma.brand.findMany({ where: { id: { in: f.brands.map((b) => b.id) } }, select: { id: true, slug: true } }),
  ]);
  const subSlug = new Map(subs.map((s) => [s.id, s.slug]));
  const brandSlug = new Map(brands.map((b) => [b.id, b.slug]));
  const tabs: WebSearchFacets["tabs"] = bySubs
    ? f.subcategories.flatMap((s) => {
        const value = subSlug.get(s.id);
        return value ? [{ kind: "sub" as const, value, label: s.label, name: s.name, imageUrl: s.imageUrl, count: s.count }] : [];
      })
    : f.tags.length >= 2
      ? f.tags.map((t) => {
          const name = t.tag.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
          return { kind: "tag" as const, value: t.tag, label: name, name, imageUrl: t.imageUrl, count: t.count };
        })
      : [];
  return {
    tabs,
    brands: f.brands.flatMap((b) => {
      const slug = brandSlug.get(b.id);
      return slug ? [{ slug, name: b.name, imageUrl: b.imageUrl, count: b.count }] : [];
    }),
    sizes: f.sizes,
    offerCount: f.offerCount,
  };
}

/** The app's store search, filters and all, with its results as web cards */
export async function webSearch(prisma: PrismaClient, ctx: ShopContext, q: WebShopQuery): Promise<WebSearchPage> {
  const filters = { sub: q.sub, tag: q.tag, brand: q.brand, size: q.size, food: q.food, offers: q.offers, sort: q.sort, exact: q.exact };
  const empty = { store: ctx.store, q: q.q ?? "", products: [], facets: null, filters, meta: null };
  if (!q.q) return empty;
  const [sub, brands] = await Promise.all([
    q.sub ? prisma.subcategory.findUnique({ where: { slug: q.sub }, select: { id: true } }) : null,
    q.brand.length ? prisma.brand.findMany({ where: { slug: { in: q.brand } }, select: { id: true } }) : [],
  ]);
  const { data, facets, searchMeta } = await searchStoreProducts(prisma, storeRef(ctx), {
    q: q.q, tag: q.tag, subcategoryId: sub?.id, brandIds: brands.map((b) => b.id), size: q.size, foodType: q.food,
    hasDiscount: q.offers, sortBy: q.sort, exact: q.exact,
  });
  const order = productOrder(data as Listing[]);
  const [cards, webFacetList] = await Promise.all([cardsById(prisma, ctx.store.id, [...order.keys()]), webFacets(prisma, facets)]);
  const products = [...order].flatMap(([id, adBannerId]): WebSearchCard[] => {
    const card = cards.get(id);
    if (!card) return [];
    const packs = q.size ? card.packs.filter((p) => p.name === q.size) : card.packs;
    return packs.length ? [{ ...card, packs, ...(adBannerId && { adBannerId }) }] : [];
  });
  const meta = searchMeta.strategy === "keyword" || !products.length
    ? null
    : { correctedQuery: searchMeta.correctedQuery ?? null, expandedTerms: searchMeta.expandedTerms ?? null };
  return { ...empty, products, facets: webFacetList, meta };
}

export async function webSuggestions(prisma: PrismaClient, ctx: ShopContext, q: string): Promise<WebSuggestion[]> {
  if (q.trim().length < 2) return [];
  const { suggestions } = await suggestSearches(prisma, storeRef(ctx), q);
  return suggestions.map(({ sponsored, ...s }) => ({ ...s, ...(sponsored && { adBannerId: sponsored.bannerId }) }));
}

/** Search before typing, for a guest: trending, festival and store-special spotlights, time-of-day picks, popular aisles */
export async function webSearchLanding(prisma: PrismaClient, ctx: ShopContext): Promise<WebSearchLanding> {
  const landing = await buildSearchLanding(prisma, storeRef(ctx));
  const ids = (rows: unknown[]) => [...productOrder(rows as Listing[]).keys()];
  const [cards, links] = await Promise.all([
    cardsById(prisma, ctx.store.id, [...landing.occasions.flatMap((o) => ids(o.products)), ...ids(landing.timePicks.products)]),
    linkBook(prisma, ctx.organizationId, []),
  ]);
  const cardsOf = (rows: unknown[]) => ids(rows).flatMap((id) => cards.get(id) ?? []);
  return {
    store: ctx.store,
    trending: landing.trending,
    occasions: landing.occasions.map((o) => {
      const href = `/collections/${o.slug}`;
      return {
        kind: o.kind, title: o.title, subtitle: o.subtitle, imageUrl: o.imageUrl, href,
        aisles: o.subcategories.map((s) => ({ label: s.name, imageUrl: null, href: links.collection(o.id, [s.id]) ?? href })),
        products: cardsOf(o.products),
      };
    }),
    timePicks: { period: landing.timePicks.period, title: landing.timePicks.title, products: cardsOf(landing.timePicks.products) },
    categories: landing.categories.flatMap((c) => {
      const href = links.category(c.id);
      return href ? [{ label: c.name, imageUrl: c.imageUrl, href }] : [];
    }),
  };
}
