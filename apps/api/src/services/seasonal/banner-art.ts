import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";
import { designBrief, type BannerDesign } from "./banner-design.js";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
// Banners keep the model's full 3:2 canvas for the home carousel; the search spotlight shows the centre 2:1 band
const OUT_WIDTH = 1536;
const OUT_HEIGHT = 1024;

export interface BannerCopy {
  title: string;
  subtitle: string;
  cta: string;
}

export class BannerArtError extends Error {}

function typography(copy: BannerCopy, textPlacement: string) {
  return `Typography is the hero of this banner and must read instantly on a phone:
- Headline "${copy.title}": extra-bold, heavy display sans-serif at poster weight, very large (cap height about 15-20% of the banner height), at most two lines, tight letter spacing
- Subtitle "${copy.subtitle}": medium weight, about a third of the headline size, close beneath it
- Button "${copy.cta}": bold text in a rounded pill with strong contrast
Text placement: ${textPlacement}
Set the text on a clean area or a solid shape with strong contrast; no busy detail behind the letters.
Spell every word exactly as given, character for character. No other text anywhere.`;
}

function prompt(scene: string, copy?: BannerCopy, design?: BannerDesign) {
  // Text-free art is overlaid with the copy by the app, which draws it on the left
  if (!copy || !design) {
    return [
      "A premium promotional banner for an Indian grocery delivery app, wide landscape format.",
      `Scene: ${scene}`,
      "Keep the left third calm and uncluttered. No text anywhere.",
      "No logos, no brand packaging, no people's faces.",
    ].join("\n\n");
  }
  const d = designBrief(design);
  return [
    "A striking, premium promotional banner for an Indian grocery delivery app, wide 3:2 landscape.",
    `Visual style: ${d.style}. Choose a fresh colour palette that suits the subject rather than a default dark green.`,
    `Subject: ${scene}`,
    `Composition: ${d.composition}`,
    typography(copy, d.textPlacement),
    "Keep every word and key subject inside the middle 80% of the width and the middle three quarters of the height; the edges may be cropped on some screens.",
    "No logos, brand packaging, prices, borders, phone frames or people's faces.",
  ].join("\n\n");
}

/** Renders a banner (with the copy set into it when given), as a 3:2 WebP small enough for phones. */
export async function renderBanner(scene: string, copy?: BannerCopy, design?: BannerDesign): Promise<Buffer> {
  const response = await new OpenAI().images.generate({
    model: IMAGE_MODEL,
    prompt: prompt(scene, copy, design),
    n: 1,
    size: "1536x1024",
    quality: "medium",
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new BannerArtError(`Image model ${IMAGE_MODEL} returned no image`);
  return prepareBanner(Buffer.from(b64, "base64"));
}

/** Any banner image, generated or uploaded, cropped to the 3:2 WebP the app expects. */
export function prepareBanner(image: Buffer) {
  return sharp(image).resize(OUT_WIDTH, OUT_HEIGHT, { fit: "cover", position: "centre" }).webp({ quality: 80 }).toBuffer();
}

export async function uploadBanner(image: Buffer, slug: string, lang: string) {
  const { url } = await putObject(`banners/seasonal/${slug}-${lang}-${randomUUID()}.webp`, image, "image/webp");
  return url;
}
