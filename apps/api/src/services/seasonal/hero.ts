import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { orgSubcategoryCandidates } from "./candidates.js";
import { designHero } from "./hero-designer.js";
import { paintBackground, paintTile, uploadHeroArt, type HeroTheme } from "./hero-art.js";

type Translations = Record<string, Record<string, string> | undefined>;

export interface HeroDraft {
  heroTitle: string;
  heroTitleTa: string;
  heroImageUrl: string;
  heroTheme: HeroTheme;
  tiles: { title: string; translations: { ta: { title: string } }; imageUrl: string; subcategoryIds: string[]; sortOrder: number }[];
}

/** Designs and paints the festive home hero. Null when the catalog can't fill a single row of tiles. */
export async function buildHero(prisma: PrismaClient, organizationId: string, description: string, slug: string): Promise<HeroDraft | null> {
  const candidates = await orgSubcategoryCandidates(prisma, organizationId);
  const design = await designHero({ description }, candidates);
  if (design.tiles.length === 0) return null;

  const [background, tileArt] = await Promise.all([
    paintBackground(design.backgroundPrompt, design.washColor, design.titleColor),
    Promise.all(design.tiles.map((t) => paintTile(t.artPrompt))),
  ]);
  const [heroImageUrl, tileUrls] = await Promise.all([
    uploadHeroArt(background.image, slug, "bg"),
    Promise.all(tileArt.map((art, i) => uploadHeroArt(art, slug, `tile${i}`))),
  ]);
  return {
    heroTitle: design.heroTitle,
    heroTitleTa: design.heroTitleTa,
    heroImageUrl,
    heroTheme: background.theme,
    tiles: design.tiles.map((t, sortOrder) => ({
      title: t.title, translations: { ta: { title: t.titleTa } }, imageUrl: tileUrls[sortOrder], subcategoryIds: t.subcategoryIds, sortOrder,
    })),
  };
}

// The Tamil hero title lives beside the collection's other Tamil copy
export function withHeroTranslation(translations: unknown, heroTitleTa: string | null) {
  const current = (translations as Translations | null) ?? {};
  const { heroTitle: _drop, ...ta } = current.ta ?? {};
  return { ...current, ta: heroTitleTa ? { ...ta, heroTitle: heroTitleTa } : ta };
}

export function heroFields(hero: HeroDraft | null) {
  return {
    heroTitle: hero?.heroTitle ?? null,
    heroImageUrl: hero?.heroImageUrl ?? null,
    heroTheme: hero ? { ...hero.heroTheme } : Prisma.DbNull,
  };
}

type HeroSource = { id: string; slug: string; title: string; subtitle: string | null; organizationId: string; translations: unknown; festivalEvent: { name: string; guidance: string | null } | null };

/** Repaints a collection's hero from scratch, e.g. for collections curated before heroes existed. */
export async function regenerateHero(prisma: PrismaClient, collection: HeroSource) {
  const event = collection.festivalEvent;
  const description = [
    `Occasion: ${event?.name ?? collection.title}`,
    `Collection: ${collection.title}${collection.subtitle ? ` (${collection.subtitle})` : ""}`,
    event?.guidance ? `Guidance: ${event.guidance}` : null,
  ].filter(Boolean).join("\n");
  const hero = await buildHero(prisma, collection.organizationId, description, collection.slug);
  await saveHero(prisma, collection, hero);
  return hero;
}

export async function saveHero(prisma: PrismaClient, collection: { id: string; translations: unknown }, hero: HeroDraft | null) {
  await prisma.$transaction([
    prisma.collectionTile.deleteMany({ where: { collectionId: collection.id } }),
    prisma.collection.update({
      where: { id: collection.id },
      data: {
        ...heroFields(hero),
        translations: withHeroTranslation(collection.translations, hero?.heroTitleTa ?? null),
        tiles: { create: hero?.tiles ?? [] },
      },
    }),
  ]);
}
