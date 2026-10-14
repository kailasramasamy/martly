import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";

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

function typography(copy: BannerCopy) {
  return `Left third: a clean, premium typographic layout on the scene's calmer area, perfectly legible, with text colours chosen for strong contrast:
- Headline, large bold modern sans-serif: "${copy.title}"
- Below it, smaller regular weight: "${copy.subtitle}"
- A small rounded pill button with dark text on a warm accent colour: "${copy.cta}"
Spell every word exactly as given, character for character. No other text anywhere.`;
}

function prompt(scene: string, copy?: BannerCopy) {
  return [
    "A premium promotional banner for an Indian grocery delivery app, wide landscape format.",
    `Scene: ${scene}`,
    copy ? typography(copy) : "Keep the left third calm and uncluttered. No text anywhere.",
    "The top and bottom eighths may be cropped on some screens: keep every word and key subject inside the middle three quarters of the height.",
    "No logos, no brand packaging, no people's faces.",
  ].join("\n\n");
}

/** Renders a banner (with the copy set into it when given), as a 3:2 WebP small enough for phones. */
export async function renderBanner(scene: string, copy?: BannerCopy): Promise<Buffer> {
  const response = await new OpenAI().images.generate({
    model: IMAGE_MODEL,
    prompt: prompt(scene, copy),
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
