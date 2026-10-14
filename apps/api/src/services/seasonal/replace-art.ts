import type { PrismaClient } from "../../../generated/prisma/client.js";
import { prepareBanner, uploadBanner } from "./banner-art.js";
import { heroTheme, MAX_ORNAMENT_DEPTH, prepareHeroBackground, prepareTileArt, uploadHeroArt, type HeroTheme } from "./hero-art.js";
import { bannerFields } from "./index.js";

// Admin uploads replace generated art through the same preparation as the generator, so a hand-picked image
// lays out exactly like a generated one: cropped, trimmed and (for the hero) re-measured

export class ArtReplaceError extends Error {}

type BannerOwner = { id: string; slug: string; imageUrl: string | null; imageUrls: unknown; textInImage: boolean };

/** Swaps one language's search banner ("art" for the text-free fallback) and keeps legacy banner rows in step. */
export async function replaceBannerImage(prisma: PrismaClient, collection: BannerOwner, lang: string, image: Buffer) {
  const textFree = !collection.textInImage;
  if (textFree !== (lang === "art")) {
    throw new ArtReplaceError(textFree ? "This banner is text-free; replace its artwork" : "Replace the English or Tamil banner");
  }
  const url = await uploadBanner(await prepareBanner(image), collection.slug, lang);
  const urls = { ...((collection.imageUrls as Record<string, string> | null) ?? {}) };
  if (!textFree) urls[lang] = url;
  const art = bannerFields({
    imageUrl: lang === "art" || lang === "en" ? url : (collection.imageUrl ?? url),
    imageUrls: textFree ? null : urls,
    textInImage: collection.textInImage,
  });
  await prisma.$transaction([
    prisma.collection.update({ where: { id: collection.id }, data: art }),
    prisma.banner.updateMany({ where: { actionType: "COLLECTION", actionTarget: collection.id }, data: art }),
  ]);
  return art;
}

/** Swaps the hero background and re-measures it, so the headline and fade fit the new art. */
export async function replaceHeroBackground(prisma: PrismaClient, collection: { id: string; slug: string; heroTheme: unknown }, image: Buffer) {
  const current = collection.heroTheme as HeroTheme | null;
  if (!current) throw new ArtReplaceError("This collection has no festive hero");
  const background = await prepareHeroBackground(image);
  const [heroImageUrl, measured] = await Promise.all([uploadHeroArt(background, collection.slug, "bg"), heroTheme(background, current.title)]);
  // A busy upload can't push the tiles below the fold any more than generated art can
  const theme = { ...measured, ornamentDepth: Math.min(measured.ornamentDepth, MAX_ORNAMENT_DEPTH) };
  await prisma.collection.update({ where: { id: collection.id }, data: { heroImageUrl, heroTheme: theme } });
  return { heroImageUrl, heroTheme: theme };
}

export async function replaceTileImage(prisma: PrismaClient, slug: string, tileId: string, image: Buffer) {
  const imageUrl = await uploadHeroArt(await prepareTileArt(image), slug, "tile");
  return prisma.collectionTile.update({ where: { id: tileId }, data: { imageUrl } });
}
