import type { WebShopQuery } from "@martly/shared/schemas";
import type { WebSearchFacets, WebSearchFilters, WebSearchLanding, WebSearchPage, WebSuggestion } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildSearchLanding } from "../search-landing.js";
import { suggestSearches } from "../search-suggest.js";
import { searchStoreProducts, type SearchFacets } from "../store-search.js";
import { cardsById, type ShopContext } from "./cards.js";
import { rankedList } from "./category-filters.js";
import { linkBook } from "./links.js";

type Listing = { productId: string; sponsored?: { bannerId: string } };

const storeRef = (ctx: ShopContext) => ({ id: ctx.store.id, organizationId: ctx.organizationId });

/** Each product once, in result order, with the banner of an ad slot it fills (unless ads are off) */
function productOrder(rows: Listing[], ads = true) {
  const order = new Map<string, string | undefined>();
  for (const r of rows) if (!order.has(r.productId)) order.set(r.productId, ads ? r.sponsored?.bannerId : undefined);
  return order;
}

/** The app's tab rule: aisles when the matches span two or more, else tags when there are two or more, else none */
async function searchTabs(prisma: PrismaClient, f: SearchFacets): Promise<WebSearchFacets["tabs"]> {
  if (f.subcategories.length >= 2) {
    const subs = await prisma.subcategory.findMany({ where: { id: { in: f.subcategories.map((s) => s.id) } }, select: { id: true, slug: true } });
    const subSlug = new Map(subs.map((s) => [s.id, s.slug]));
    return f.subcategories.flatMap((s) => {
      const value = subSlug.get(s.id);
      return value ? [{ kind: "sub" as const, value, label: s.label, name: s.name, imageUrl: s.imageUrl, count: s.count }] : [];
    });
  }
  if (f.tags.length < 2) return [];
  return f.tags.map((t) => {
    const name = t.tag.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
    return { kind: "tag" as const, value: t.tag, label: name, name, imageUrl: t.imageUrl, count: t.count };
  });
}

function filtersOf(q: WebShopQuery): WebSearchFilters {
  return {
    sub: q.sub, tag: q.tag, size: q.size, exact: q.exact,
    brand: q.brand, price: q.price, off: q.off ?? null, rating: q.rating ?? null, offers: q.offers, food: q.food ?? null, stock: q.stock, sort: q.sort,
  };
}

/**
 * The app's store search for the tab, size and ranking (ads included), then the category pages' filters over its results,
 * so search gets the same sidebar and counts. Ads drop under a brand filter or another sort, as in the app.
 */
export async function webSearch(prisma: PrismaClient, ctx: ShopContext, q: WebShopQuery): Promise<WebSearchPage> {
  const filters = filtersOf(q);
  const empty = { store: ctx.store, q: q.q ?? "", products: [], total: 0, facets: null, filters, meta: null };
  if (!q.q) return empty;
  const sub = q.sub ? await prisma.subcategory.findUnique({ where: { slug: q.sub }, select: { id: true } }) : null;
  const { data, facets, searchMeta } = await searchStoreProducts(prisma, storeRef(ctx), {
    q: q.q, tag: q.tag, subcategoryId: sub?.id, size: q.size, sortBy: q.sort, exact: q.exact,
  });
  // As in the app, a brand filter takes the ads out
  const order = productOrder(data as Listing[], !q.brand.length);
  const [list, tabs] = await Promise.all([rankedList(prisma, ctx.store.id, order, q), searchTabs(prisma, facets)]);
  const { products } = list;
  const meta = searchMeta.strategy === "keyword" || !products.length
    ? null
    : { correctedQuery: searchMeta.correctedQuery ?? null, expandedTerms: searchMeta.expandedTerms ?? null };
  return { ...empty, products, total: list.total, facets: { ...list.facets, tabs, sizes: facets.sizes }, meta };
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
