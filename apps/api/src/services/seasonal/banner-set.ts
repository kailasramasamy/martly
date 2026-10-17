import { renderBanner, uploadBanner, type BannerCopy } from "./banner-art.js";
import { bannerTextMatches } from "./verify-text.js";
import type { BannerArtPurpose, PrismaClient } from "../../../generated/prisma/client.js";
import { chooseDesign, recordDesign, type BannerDesign } from "./banner-design.js";

const ATTEMPTS = 2;
const CTA: Record<string, string> = { en: "Shop now", ta: "இப்போது வாங்கு" };

export interface BannerSet {
  imageUrl: string;
  imageUrls: Record<string, string> | null;
  textInImage: boolean;
}

export type BannerLog = (message: string) => void;

async function proofedBanner(scene: string, copy: BannerCopy, design: BannerDesign, lang: string, log: BannerLog) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const image = await renderBanner(scene, copy, design);
    const check = await bannerTextMatches(image, copy);
    if (check.ok) return image;
    log(`${lang} banner attempt ${attempt} failed proofreading: ${check.issues}`);
  }
  return null;
}

/**
 * One banner per language with the copy set into the artwork. English is required; a language that keeps
 * failing proofreading falls back to the English banner on the client. If English itself can't be rendered
 * cleanly, the set falls back to text-free art with the copy drawn by the app instead.
 */
export async function buildBannerSet(
  scene: string,
  copies: Record<string, Omit<BannerCopy, "cta">>,
  slug: string,
  log: BannerLog,
  design: BannerDesign,
): Promise<BannerSet> {
  const langs = Object.keys(copies);
  // Every language shares one design so the English and Tamil banners look alike
  const images = await Promise.all(langs.map((lang) => proofedBanner(scene, { ...copies[lang], cta: CTA[lang] ?? CTA.en }, design, lang, log)));
  const passed = langs.flatMap((lang, i) => (images[i] ? [[lang, images[i]] as const] : []));
  if (!passed.some(([lang]) => lang === "en")) {
    log("English banner failed proofreading; using text-free art");
    return { imageUrl: await uploadBanner(await renderBanner(scene), slug, "art"), imageUrls: null, textInImage: false };
  }
  const urls = Object.fromEntries(await Promise.all(passed.map(async ([lang, image]) => [lang, await uploadBanner(image, slug, lang)])));
  return { imageUrl: urls.en, imageUrls: urls, textInImage: true };
}

/** Picks a layout and style this owner hasn't used lately, paints the set in it, and remembers the choice */
export async function buildDesignedBannerSet(
  prisma: PrismaClient,
  owner: { organizationId?: string | null; brandId?: string | null; purpose: BannerArtPurpose },
  scene: string,
  copies: Record<string, Omit<BannerCopy, "cta">>,
  slug: string,
  log: BannerLog,
): Promise<BannerSet> {
  const design = await chooseDesign(prisma, owner);
  const art = await buildBannerSet(scene, copies, slug, log, design);
  await recordDesign(prisma, { ...design, ...owner, imageUrl: art.imageUrl });
  return art;
}
