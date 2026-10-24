import {
  HERO_BUY_GET_MIN, HERO_BUY_GET_PRODUCTS, HERO_CARD_THEMES, HERO_MIN_CARDS, HERO_MOST_BOUGHT_PRODUCTS, HERO_RIGHT_NOW_MIN, HERO_RIGHT_NOW_PRODUCTS,
  type HeroCardKind, type HeroCardTheme,
} from "@martly/shared/constants";
import { homeSectionConfigSchemas } from "@martly/shared/schemas";
import type { HeroCard, HomeTheme } from "@martly/shared/types";
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

function blend(hex: string, toward: string, amount: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [parse(hex), parse(toward)];
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

// A festival's designer theme as card colours; a dark festival still washes the page in a pale tint of its colour,
// so the header and search bar always sit on light
function festivalTheme(theme: HomeTheme): HeroCardTheme {
  const page = "#f8fafc";
  if (!theme.dark) {
    // The card is shaded a touch towards the ink, so it stands off the wash of the same colour
    return {
      tint: theme.background, tintSoft: blend(theme.background, page, 0.5),
      ink: theme.title, card: blend(theme.background, theme.title, 0.08), cardInk: theme.title,
    };
  }
  return {
    tint: blend(theme.background, page, 0.78), tintSoft: blend(theme.background, page, 0.9),
    ink: theme.background, card: theme.background, cardInk: theme.title,
  };
}

async function festive(ctx: ResolveContext): Promise<Card | null> {
  const [hero] = await festiveHeroesFor(ctx);
  if (!hero) return null;
  const { theme, tiles, ...festival } = hero;
  return {
    id: `festive-${hero.id}`, kind: "FESTIVE", theme: festivalTheme(theme),
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

async function storeSpecial(ctx: ResolveContext): Promise<Card | null> {
  const [collection] = await storeSpecials(ctx.prisma, ctx.store.id, ctx.store.organizationId, 1);
  return collection
    ? { id: `store-special-${collection.id}`, kind: "STORE_SPECIAL", theme: HERO_CARD_THEMES.STORE_SPECIAL, collection }
    : null;
}

// The collection the admin set for this part of the day, each product once (its first size) so a row is a product
async function rightNow(ctx: ResolveContext, config: Config): Promise<Card | null> {
  const dayPart = getTimePeriod();
  const collection = await liveCollection(ctx, config.rightNow[dayPart] ?? null);
  if (!collection) return null;
  const ranked = await rankedCollectionProductIds(ctx.prisma, collection.id, ctx.store.id, 1, HERO_RIGHT_NOW_PRODUCTS);
  if (ranked.length < HERO_RIGHT_NOW_MIN) return null;
  const sizes = await withAllSizes(ctx.prisma, ctx.store.id, ranked.map((r) => ({ productId: r.id })));
  const products = sizes.filter((sp, i) => sizes.findIndex((o) => o.productId === sp.productId) === i);
  const { id, title, subtitle, translations } = collection;
  return {
    id: `right-now-${id}`, kind: "RIGHT_NOW", theme: HERO_CARD_THEMES.RIGHT_NOW, dayPart,
    collection: { id, title, subtitle, translations }, products, total: ranked[0].total,
  };
}

type Config = ReturnType<typeof homeSectionConfigSchemas.HERO_CARDS.parse>;

const BUILDERS: Record<HeroCardKind, (ctx: ResolveContext, config: Config) => Promise<Card | null>> = {
  FESTIVE: festive, BUY_GET: buyGet, MOST_BOUGHT: mostBoughtCard, STORE_SPECIAL: storeSpecial, RIGHT_NOW: rightNow,
};

/** The tall cards leading Home, in the admin's order; a card the store has too little for is left out */
export const heroCards: SectionResolver = async (ctx, entry) => {
  const config = homeSectionConfigSchemas.HERO_CARDS.parse(entry.config);
  const cards = (await Promise.all(config.cards.map((kind) => BUILDERS[kind](ctx, config)))).filter((c): c is Card => c !== null);
  return cards.length >= HERO_MIN_CARDS ? { ...sectionBase(entry), type: "HERO_CARDS", cards } : null;
};
