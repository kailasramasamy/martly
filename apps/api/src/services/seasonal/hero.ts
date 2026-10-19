import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { orgSubcategoryCandidates } from "./candidates.js";
import { designHero } from "./hero-designer.js";
import { paintStrip, paintTile, stripTheme, uploadHeroArt, type HeroTheme } from "./hero-art.js";

type Translations = Record<string, Record<string, string> | undefined>;

export interface HeroDraft {
  heroTitle: string;
  heroTitleTa: string;
  heroKicker: string;
  heroKickerTa: string;
  heroSubtitle: string;
  heroSubtitleTa: string;
  heroImageUrl: string;
  heroTheme: HeroTheme;
  tiles: { title: string; translations: { ta: { title: string } }; imageUrl: string; subcategoryIds: string[]; sortOrder: number }[];
}

/** Designs and paints the festive home hero. Null when the catalog can't fill a single row of tiles. */
export async function buildHero(prisma: PrismaClient, organizationId: string, description: string, slug: string): Promise<HeroDraft | null> {
  const candidates = await orgSubcategoryCandidates(prisma, organizationId);
  const design = await designHero({ description }, candidates);
  if (design.tiles.length === 0) return null;

  const heroTheme = { ...stripTheme(design.themeColor), font: design.font };
  const [strip, tileArt] = await Promise.all([
    paintStrip(design.silhouetteScene, heroTheme.background),
    Promise.all(design.tiles.map((t) => paintTile(t.artPrompt))),
  ]);
  const [heroImageUrl, tileUrls] = await Promise.all([
    uploadHeroArt(strip, slug, "strip"),
    Promise.all(tileArt.map((art, i) => uploadHeroArt(art, slug, `tile${i}`))),
  ]);
  return {
    heroTitle: design.heroTitle,
    heroTitleTa: design.heroTitleTa,
    heroKicker: design.heroKicker,
    heroKickerTa: design.heroKickerTa,
    heroSubtitle: design.heroSubtitle,
    heroSubtitleTa: design.heroSubtitleTa,
    heroImageUrl,
    heroTheme,
    tiles: design.tiles.map((t, sortOrder) => ({
      title: t.title, translations: { ta: { title: t.titleTa } }, imageUrl: tileUrls[sortOrder], subcategoryIds: t.subcategoryIds, sortOrder,
    })),
  };
}

type HeroCopyTa = { heroTitle: string | null; heroKicker: string | null; heroSubtitle: string | null };

// The Tamil hero lines live beside the collection's other Tamil copy
export function withHeroTranslation(translations: unknown, copy: HeroCopyTa | null) {
  const current = (translations as Translations | null) ?? {};
  const { heroTitle: _t, heroKicker: _k, heroSubtitle: _s, ...ta } = current.ta ?? {};
  const lines = Object.fromEntries(Object.entries(copy ?? {}).filter(([, v]) => v)) as Record<string, string>;
  return { ...current, ta: { ...ta, ...lines } };
}

export function heroFields(hero: HeroDraft | null) {
  return {
    heroTitle: hero?.heroTitle ?? null,
    heroKicker: hero?.heroKicker ?? null,
    heroSubtitle: hero?.heroSubtitle ?? null,
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
        translations: withHeroTranslation(collection.translations, hero && {
          heroTitle: hero.heroTitleTa, heroKicker: hero.heroKickerTa, heroSubtitle: hero.heroSubtitleTa,
        }),
        tiles: { create: hero?.tiles ?? [] },
      },
    }),
  ]);
}
