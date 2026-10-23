import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";
import { designBrief, type BannerDesign } from "./banner-design.js";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const FULL_FRAME = "Compose for the full 3:2 frame, filled edge to edge. Some screens show only its centre 2:1 band, so keep every word and key subject inside the middle 80% of the width and the middle two thirds of the height.";

/**
 * Landscape banners keep the model's full 3:2 canvas for the home carousel (the search spotlight shows the centre 2:1
 * band); portrait is the 2:3 brand poster; wide is the 2:1 strip atop a category page, painted on the 3:2 canvas (the
 * model's widest) and trimmed to its centre band
 */
export type BannerFormat = "landscape" | "portrait" | "wide";
// Images are painted on the model's canvas and saved at the size phones show them (about 3x a phone's points), which
// keeps a poster near 50 KB instead of 180 KB
const BANNER_QUALITY = 75;
const FORMATS = {
  landscape: { size: "1536x1024", width: 1200, height: 800, words: "wide 3:2 landscape", frame: FULL_FRAME },
  portrait: { size: "1024x1536", width: 600, height: 900, words: "tall 2:3 portrait poster", frame: FULL_FRAME },
  wide: {
    size: "1536x1024", width: 1200, height: 600, words: "wide 2:1 banner strip",
    frame: [
      "This canvas is trimmed to a 2:1 strip: the top eighth and the bottom eighth are cut off.",
      "Leave a plain background margin of at least a sixth of the canvas height above the headline and below the lowest subject, with no letters, objects or props in those margins.",
      "Everything that matters sits in one horizontal band through the middle; keep words inside the middle 80% of the width.",
    ].join(" "),
  },
} as const;

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

function prompt(scene: string, format: BannerFormat, copy?: BannerCopy, design?: BannerDesign) {
  // Text-free art is overlaid with the copy by the app, which draws it on the left
  if (!copy || !design) {
    return [
      `A premium promotional banner for an Indian grocery delivery app, ${FORMATS[format].words} format.`,
      `Scene: ${scene}`,
      "Keep the left third calm and uncluttered. No text anywhere.",
      "No logos, no brand packaging, no people's faces.",
    ].join("\n\n");
  }
  const d = designBrief(design);
  return [
    `A striking, premium promotional banner for an Indian grocery delivery app, ${FORMATS[format].words}.`,
    `Visual style: ${d.style}. Choose a fresh colour palette that suits the subject rather than a default dark green.`,
    `Subject: ${scene}`,
    `Composition: ${d.composition}`,
    typography(copy, d.textPlacement),
    FORMATS[format].frame,
    "No logos, brand packaging, prices, borders, phone frames or people's faces.",
  ].join("\n\n");
}

/** Renders a banner (with the copy set into it when given), as a WebP small enough for phones. */
export async function renderBanner(scene: string, copy?: BannerCopy, design?: BannerDesign, format: BannerFormat = "landscape"): Promise<Buffer> {
  const response = await new OpenAI().images.generate({
    model: IMAGE_MODEL,
    prompt: prompt(scene, format, copy, design),
    n: 1,
    size: FORMATS[format].size,
    quality: "medium",
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new BannerArtError(`Image model ${IMAGE_MODEL} returned no image`);
  return prepareBanner(Buffer.from(b64, "base64"), format);
}

/** Any banner image, generated or uploaded, cropped to the WebP the app expects. */
export function prepareBanner(image: Buffer, format: BannerFormat = "landscape") {
  const { width, height } = FORMATS[format];
  return sharp(image).resize(width, height, { fit: "cover", position: "centre" }).webp({ quality: BANNER_QUALITY }).toBuffer();
}

/** The pixel size a banner of this format is saved at */
export const bannerSize = (format: BannerFormat) => ({ width: FORMATS[format].width, height: FORMATS[format].height });

export async function uploadBanner(image: Buffer, slug: string, lang: string) {
  const { url } = await putObject(`banners/seasonal/${slug}-${lang}-${randomUUID()}.webp`, image, "image/webp");
  return url;
}
