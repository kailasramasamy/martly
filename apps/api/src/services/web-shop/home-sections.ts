import type { PrismaClient } from "../../../generated/prisma/client.js";
import { withoutHeroDuplicates } from "@martly/shared/home";
import type { HeroCard, HomeSection, WebHeroCard, WebHomeSection, WebProductCard, WebShopStore } from "@martly/shared/types";
import { homeSectionsPage } from "../home/page.js";
import { cardsById } from "./cards.js";
import { linkBook, type LinkBook } from "./links.js";
import { systemSection } from "./home-system.js";

type Row = { productId: string };
/** Turns a section's listing rows into the page's product shape: ids while collecting, cards when drawing */
export type Cards<P> = (rows: unknown[]) => P[];
type Mapped<P> = WebHomeSection<P> | null;

const RIGHT_NOW_KICKER = { morning: "Picked for this morning", afternoon: "Picked for this afternoon", evening: "Picked for this evening", night: "Picked for tonight" };

function heroCard<P>(card: HeroCard<unknown>, links: LinkBook, cards: Cards<P>, store: WebShopStore): WebHeroCard<P> | null {
  const base = { id: card.id, kind: card.kind, theme: card.theme, kicker: null, subtitle: null, imageUrl: null, products: [] as P[], total: 0, tiles: [] };
  switch (card.kind) {
    case "FESTIVE": {
      const f = card.festival;
      const href = links.collection(f.id);
      if (!href) return null;
      const tiles = f.tiles.map((t) => ({ label: t.title, imageUrl: t.imageUrl, href: `${href}?tile=${t.id}` }));
      return { ...base, kicker: f.kicker, title: f.title, subtitle: f.subtitle, imageUrl: f.imageUrl, href, tiles };
    }
    case "BUY_GET":
      return {
        ...base, kicker: "Free with your order", title: "Buy 1 Get 1 Free", subtitle: `${card.total} free-item offers`, href: "/offers/buy-get",
        products: cards(card.products), total: card.total,
      };
    case "MOST_BOUGHT":
      return { ...base, title: "Most bought", subtitle: `At ${store.name} this month`, href: "/best-sellers", products: cards(card.products) };
    case "STORE_SPECIAL": {
      const c = card.collection;
      const href = links.collection(c.id);
      if (!href) return null;
      const tiles = c.subcategories.map((s) => ({ label: s.name, imageUrl: null, href: links.collection(c.id, [s.id]) ?? href }));
      return { ...base, kicker: "Only at this store", title: c.title, subtitle: c.subtitle, imageUrl: c.imageUrl, href, tiles, products: cards(c.products) };
    }
    case "RIGHT_NOW":
    case "COLLECTION": {
      const href = links.collection(card.collection.id);
      if (!href) return null;
      return {
        ...base, kicker: card.kind === "RIGHT_NOW" ? RIGHT_NOW_KICKER[card.dayPart] : null, title: card.collection.title,
        subtitle: card.collection.subtitle, href, products: cards(card.products), total: card.total,
        ...(card.kind === "RIGHT_NOW" && { dayPart: card.dayPart }),
      };
    }
  }
}

function seeAllHref(links: LinkBook, s: HomeSection<unknown>) {
  if (!s.seeAll) return null;
  if ("collectionId" in s.seeAll) return links.collection(s.seeAll.collectionId, s.seeAll.subcategoryIds);
  const brand = s.seeAll.href.match(/^\/brand\/(.+)$/);
  return brand ? links.brand(brand[1]) : null;
}

/** Product-led sections */
function productSection<P>(s: HomeSection<unknown>, links: LinkBook, cards: Cards<P>, base: { id: string; title: string | null; subtitle: string | null; href: string | null }): Mapped<P> {
  switch (s.type) {
    case "PRODUCT_ROW":
      return { ...base, type: s.type, header: s.header, products: cards(s.products), total: s.total };
    case "TABBED_ROW": {
      const tabs = s.tabs.flatMap((t) => {
        const href = links.collection(t.collectionId);
        return href ? [{ label: t.label, imageUrl: t.imageUrl, href, slug: href.split("/").pop()! }] : [];
      });
      return { ...base, href: tabs[0]?.href ?? null, type: s.type, tabStyle: s.tabStyle, tint: s.tint, tabs, products: cards(s.products), total: s.total };
    }
    case "PRICE_BAND_DEALS":
      return {
        ...base, href: `/deals/${s.id}`, type: s.type, headline: s.headline, bands: s.bands.map((b) => ({ label: b.label, value: b.id })),
        chips: s.chips.flatMap((c) => {
          const value = links.categorySlug(c.categoryId);
          return value ? [{ label: c.label, imageUrl: c.imageUrl, value }] : [];
        }),
        products: cards(s.products), total: s.total,
      };
    case "BRAND_CARD":
      return { ...base, type: s.type, brand: { name: s.brand.name, logoUrl: s.brand.logoUrl, themeColor: s.brand.themeColor }, imageUrl: s.imageUrl, tint: s.tint, products: cards(s.products) };
    case "BUY_GET_DEALS":
      return { ...base, href: "/offers/buy-get", type: s.type, products: cards(s.products), total: s.total };
    case "CAMPAIGN_CARD": {
      const tiles = s.tiles.flatMap((t) => {
        const href = links.collection(s.collectionId, t.subcategoryIds);
        return href ? [{ label: t.label, imageUrl: null, images: t.images, productCount: t.productCount, href }] : [];
      });
      return {
        ...base, href: links.collection(s.collectionId), type: s.type, offerLabel: s.offerLabel, imageUrl: s.imageUrl, theme: s.theme,
        tiles, highlights: cards(s.highlights), productCount: s.productCount, endsAt: s.endsAt,
      };
    }
    case "STORE_SPECIALS": {
      const collections = s.collections.flatMap((c) => {
        const href = links.collection(c.id);
        if (!href) return [];
        const aisles = c.subcategories.map((a) => ({ label: a.name, imageUrl: null, href: links.collection(c.id, [a.id]) ?? href }));
        return [{ title: c.title, subtitle: c.subtitle, imageUrl: c.imageUrl, href, aisles, products: cards(c.products) }];
      });
      return { ...base, type: s.type, collections };
    }
    default:
      return null;
  }
}

/** Tile- and art-led sections */
function tileSection<P>(s: HomeSection<unknown>, links: LinkBook, base: { id: string; title: string | null; subtitle: string | null; href: string | null }): Mapped<P> {
  const tile = (label: string, imageUrl: string | null, href: string | null) => (href ? [{ label, imageUrl, href }] : []);
  switch (s.type) {
    case "THEME_BAND":
      return { ...base, type: s.type, tint: s.tint, imageUrl: s.imageUrl, tiles: s.tiles.flatMap((t) => tile(t.label, t.imageUrl, links.category(t.subcategoryId))) };
    case "EXPLORE_GRID":
    case "STORE_GRID":
      return {
        ...base, type: s.type,
        tiles: s.tiles.flatMap((t) => tile(t.label, t.imageUrl, links.collection(t.collectionId, t.subcategoryIds)).map((x) => ({ ...x, packImages: t.packImages, wide: t.wide }))),
      };
    case "BESTSELLER_CATEGORIES":
      return { ...base, type: s.type, categories: s.categories.flatMap((c) => tile(c.name, null, links.category(c.id)).map((x) => ({ ...x, images: c.images, more: c.more }))) };
    case "CATEGORY_DIRECTORY":
      return {
        ...base, type: s.type,
        groups: s.groups.flatMap((g) => tile(g.name, null, links.category(g.departmentId)).map((x) => ({
          ...x, tiles: g.tiles.flatMap((t) => tile(t.name, t.imageUrl, links.category(t.categoryId))),
        }))),
      };
    default:
      return null;
  }
}

function toWebSection<P>(s: HomeSection<unknown>, links: LinkBook, cards: Cards<P>, store: WebShopStore, brands: BrandRail): Mapped<P> {
  const base = { id: s.id, title: s.title, subtitle: s.subtitle, href: seeAllHref(links, s) };
  if (s.type === "HERO_CARDS") {
    const heroCards = s.cards.flatMap((c) => heroCard(c, links, cards, store) ?? []);
    return heroCards.length ? { ...base, type: s.type, cards: heroCards } : null;
  }
  return productSection(s, links, cards, base) ?? tileSection(s, links, base) ?? ("data" in s ? systemSection(s, links, cards, base, brands) : null);
}

export type BrandRail = { id: string; name: string; imageUrl: string | null; themeColor: string | null }[];

/** Every product id the sections show, in order */
function productIdsOf(sections: HomeSection<unknown>[], links: LinkBook, store: WebShopStore) {
  const ids: string[] = [];
  const collect: Cards<string> = (rows) => {
    for (const r of rows as Row[]) ids.push(r.productId);
    return [];
  };
  for (const s of sections) toWebSection(s, links, collect, store, []);
  return [...new Set(ids)];
}

/** Banner targets that are products, which need their slugs looked up */
function bannerProductIds(sections: HomeSection<unknown>[]) {
  return sections.flatMap((s) => ("data" in s && Array.isArray(s.data.banners) ? s.data.banners as { actionType: string; actionTarget: string | null }[] : []))
    .flatMap((b) => (b.actionType === "PRODUCT" && b.actionTarget ? [b.actionTarget] : []));
}

/** A page of the app's Home for the shopper's store, as the website draws it */
export async function webHomeSections(
  prisma: PrismaClient, store: WebShopStore, organizationId: string, cursor: string | undefined, brands: () => Promise<BrandRail>,
): Promise<{ sections: WebHomeSection[]; nextCursor: string | null }> {
  const page = await homeSectionsPage(prisma, { id: store.id, organizationId, freeDeliveryThreshold: null }, "", cursor, "rail");
  const sections = withoutHeroDuplicates(page.sections as HomeSection<unknown>[]);
  const links = await linkBook(prisma, organizationId, bannerProductIds(sections));
  const [cardOf, brandRail] = await Promise.all([
    cardsById(prisma, store.id, productIdsOf(sections, links, store)),
    sections.some((s) => s.type === "BRAND_RAIL") ? brands() : Promise.resolve([]),
  ]);
  const cards: Cards<WebProductCard> = (rows) => [...new Set((rows as Row[]).map((r) => r.productId))].flatMap((id) => cardOf.get(id) ?? []);
  return { sections: sections.flatMap((s) => toWebSection(s, links, cards, store, brandRail) ?? []), nextCursor: page.nextCursor };
}
