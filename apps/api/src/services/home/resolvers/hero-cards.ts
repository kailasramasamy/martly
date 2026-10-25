import {
  festivalCardTheme, HERO_BUY_GET_MIN, HERO_BUY_GET_PRODUCTS, HERO_CARD_PALETTES, HERO_CARD_THEMES, HERO_COLLECTION_MIN,
  HERO_COLLECTION_PRODUCTS, HERO_MIN_CARDS, HERO_MOST_BOUGHT_PRODUCTS, HERO_RIGHT_NOW_MIN, HERO_RIGHT_NOW_PRODUCTS, type FixedHeroCardKind,
} from "@martly/shared/constants";
import { homeSectionConfigSchemas, type HeroCardEntry } from "@martly/shared/schemas";
import type { HeroCard } from "@martly/shared/types";
import { rankedCollectionProductIds } from "../../collection-products.js";
import { storeSpecials } from "../../search-landing.js";
import { withAllSizes } from "../../store-feed.js";
import { getTimePeriod } from "../../time-picks.js";
import { buyGetRow } from "../buy-get.js";
import { mostBought } from "../most-bought.js";
import { sectionBase, type ResolveContext, type SectionResolver } from "../types.js";
import { liveCollection } from "./collection.js";
import { festiveHeroesFor } from "./system.js";

type Card = HeroCard<unknown>;

async function festive(ctx: ResolveContext): Promise<Card | null> {
  const [hero] = await festiveHeroesFor(ctx);
  if (!hero) return null;
  const { theme, tiles, ...festival } = hero;
  return {
    id: `festive-${hero.id}`, kind: "FESTIVE", theme: festivalCardTheme(theme),
    festival: { ...festival, tiles: tiles.map(({ id, title, translations, imageUrl }) => ({ id, title, translations, imageUrl })) },
  };
}

async function buyGet(ctx: ResolveContext): Promise<Card | null> {
  const { products, total } = await buyGetRow(ctx.prisma, ctx.store.id, ctx.now, HERO_BUY_GET_PRODUCTS);
  return total >= HERO_BUY_GET_MIN ? { id: "buy-get", kind: "BUY_GET", theme: HERO_CARD_THEMES.BUY_GET, products, total } : null;
}

async function mostBoughtCard(ctx: ResolveContext): Promise<Card | null> {
  const products = await mostBought(ctx.prisma, ctx.store.id, HERO_MOST_BOUGHT_PRODUCTS);
  return products.length === HERO_MOST_BOUGHT_PRODUCTS
    ? { id: "most-bought", kind: "MOST_BOUGHT", theme: HERO_CARD_THEMES.MOST_BOUGHT, products }
    : null;
}

// The special the admin picked, or the store's latest one
async function storeSpecial(ctx: ResolveContext, entry: Extract<HeroCardEntry, { kind: "STORE_SPECIAL" }>): Promise<Card | null> {
  const [collection] = await storeSpecials(ctx.prisma, ctx.store.id, ctx.store.organizationId, 1, entry.collectionId);
  return collection
    ? { id: `store-special-${collection.id}`, kind: "STORE_SPECIAL", theme: HERO_CARD_THEMES.STORE_SPECIAL, collection }
    : null;
}

// A live collection's top products at this store, each once (its first size) so a row is a product; null when it has
// fewer than `min` in stock
async function collectionProducts(ctx: ResolveContext, collectionId: string | null, take: number, min: number) {
  const collection = await liveCollection(ctx, collectionId);
  if (!collection) return null;
  const ranked = await rankedCollectionProductIds(ctx.prisma, collection.id, ctx.store.id, 1, take);
  if (ranked.length < min) return null;
  const sizes = await withAllSizes(ctx.prisma, ctx.store.id, ranked.map((r) => ({ productId: r.id })));
  const products = sizes.filter((sp, i) => sizes.findIndex((o) => o.productId === sp.productId) === i);
  const { id, title, subtitle, translations } = collection;
  return { collection: { id, title, subtitle, translations }, products, total: ranked[0].total };
}

// The collection the admin set for this part of the day
async function rightNow(ctx: ResolveContext, config: Config): Promise<Card | null> {
  const dayPart = getTimePeriod();
  const body = await collectionProducts(ctx, config.rightNow[dayPart] ?? null, HERO_RIGHT_NOW_PRODUCTS, HERO_RIGHT_NOW_MIN);
  return body && { id: `right-now-${body.collection.id}`, kind: "RIGHT_NOW", theme: HERO_CARD_THEMES.RIGHT_NOW, dayPart, ...body };
}

async function collectionCard(ctx: ResolveContext, entry: Extract<HeroCardEntry, { kind: "COLLECTION" }>): Promise<Card | null> {
  const body = await collectionProducts(ctx, entry.collectionId, HERO_COLLECTION_PRODUCTS, HERO_COLLECTION_MIN);
  return body && { id: `collection-${body.collection.id}`, kind: "COLLECTION", theme: HERO_CARD_PALETTES[entry.palette], ...body };
}

type Config = ReturnType<typeof homeSectionConfigSchemas.HERO_CARDS.parse>;

const BUILDERS: Record<Exclude<FixedHeroCardKind, "STORE_SPECIAL">, (ctx: ResolveContext, config: Config) => Promise<Card | null>> = {
  FESTIVE: festive, BUY_GET: buyGet, MOST_BOUGHT: mostBoughtCard, RIGHT_NOW: rightNow,
};

function buildCard(ctx: ResolveContext, config: Config, card: HeroCardEntry) {
  if (card.kind === "COLLECTION") return collectionCard(ctx, card);
  if (card.kind === "STORE_SPECIAL") return storeSpecial(ctx, card);
  return BUILDERS[card.kind](ctx, config);
}

/** The tall cards leading Home, in the admin's order; a card the store has too little for is left out */
export const heroCards: SectionResolver = async (ctx, entry) => {
  const config = homeSectionConfigSchemas.HERO_CARDS.parse(entry.config);
  const built = (await Promise.all(config.cards.map((card) => buildCard(ctx, config, card)))).filter((c): c is Card => c !== null);
  // "Latest store special" can land on one that's also picked by name; it shows once, in the earlier slot
  const cards = built.filter((c, i) => built.findIndex((o) => o.id === c.id) === i);
  return cards.length >= HERO_MIN_CARDS ? { ...sectionBase(entry), type: "HERO_CARDS", cards } : null;
};
