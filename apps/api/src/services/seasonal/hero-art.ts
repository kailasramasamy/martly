import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";
import { BannerArtError } from "./banner-art.js";
import { contrast, fromHsl, hex, rgb, toHsl } from "../color.js";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const STRIP_WIDTH = 1200;
const TILE_SIZE = 512;
// Silhouettes are painted on this flat grey; the recolour maps it to exactly the wash, so the strip melts into the
// wash above (header, search) and below (tiles) with no seam
const GREY_BACKDROP = "#808080";
// The strongest silhouette tone is the wash moved this far towards the ink: faint enough that the greeting over it stays calm
const TONE_STRENGTH = 0.28;
// Tones are scaled so this share of them stays under full strength, which evens out faint and bold source art alike
const TONE_PERCENTILE = 0.98;
// Brightness this close to the backdrop is noise from the model, not a shape, and stays the wash
const NOISE_FLOOR = 0.06;
const STRIP_PADDING = 0.06;
const MAX_STRIP_ASPECT = 1 / 1.9;
const MIN_TRANSPARENT_SHARE = 0.15;
// Self-check for strips: most of the painting's border must be the flat grey backdrop, otherwise the model painted
// a vignette or gradient that would tint the whole strip, and it is repainted once
const MIN_FLAT_BORDER = 0.8;
const FLAT_TOLERANCE = 10;
const ATTEMPTS = 2;
// The festival's hue as a pale wash behind the whole block, with text in a deep shade of the same hue
const WASH_LIGHTNESS = 0.94;
const MAX_WASH_SATURATION = 0.7;
const MAX_INK_SATURATION = 0.75;
const INK_START_LIGHTNESS = 0.4;
const MIN_INK_CONTRAST = 7;
const STEP = 0.02;

/** The festive block's colours: a pale wash from the status bar to the tiles, and the deep ink its text is set in */
export interface HeroTheme {
  background: string;
  title: string;
  dark: boolean;
  /** Headline typeface (a FestiveFont); absent on heroes made before fonts were picked */
  font?: string;
}

export async function generate(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024", transparent: boolean) {
  const response = await new OpenAI().images.generate({
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size,
    quality: "medium",
    ...(transparent ? { background: "transparent" as const, output_format: "png" as const } : {}),
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new BannerArtError(`Image model ${IMAGE_MODEL} returned no image`);
  return Buffer.from(b64, "base64");
}

/** The festival's hue as a pale wash, and an ink of the same hue darkened until text reads clearly on the wash */
export function washTheme(proposed: string): HeroTheme {
  const [h, sat] = toHsl(rgb(proposed) ?? [24, 110, 70]);
  const wash = fromHsl([h, Math.min(sat, MAX_WASH_SATURATION), WASH_LIGHTNESS]);
  const inkSat = Math.min(sat, MAX_INK_SATURATION);
  let l = INK_START_LIGHTNESS;
  while (l > STEP && contrast(wash, fromHsl([h, inkSat, l])) < MIN_INK_CONTRAST) l -= STEP;
  return { background: hex(wash), title: hex(fromHsl([h, inkSat, l])), dark: false };
}

// The grey every edge of the painting shares, i.e. the backdrop the model actually painted
function backdropLevel(grey: Buffer, width: number, height: number) {
  const edge: number[] = [];
  for (let x = 0; x < width; x += 4) edge.push(grey[x], grey[(height - 1) * width + x]);
  for (let y = 0; y < height; y += 4) edge.push(grey[y * width], grey[y * width + width - 1]);
  return edge.sort((a, b) => a - b)[edge.length >> 1];
}

// Rows holding silhouette, so the strip is cropped to the art and not the empty backdrop around it
function contentRows(tone: Float32Array, width: number, height: number): [number, number] {
  let top = height, bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      if (tone[y * width + x] !== 0) { top = Math.min(top, y); bottom = y; break; }
    }
  }
  return top > bottom ? [0, height] : [top, bottom + 1];
}

// The tone most shapes stay under, so the strongest shapes land at full strength whatever the source's contrast
function toneScale(tone: Float32Array) {
  const sizes = Array.from(tone, Math.abs).filter((t) => t > 0).sort((a, b) => a - b);
  return sizes.length ? sizes[Math.floor((sizes.length - 1) * TONE_PERCENTILE)] : 1;
}

/** Turns grey silhouettes, lighter or darker than their backdrop, into faint shades of the ink on exactly the wash */
async function tonal(image: Buffer, wash: number[], ink: number[]) {
  const { data, info } = await sharp(image).flatten({ background: GREY_BACKDROP }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const backdrop = backdropLevel(data, width, height);
  const tone = new Float32Array(width * height);
  for (let i = 0; i < tone.length; i++) {
    const d = data[i] - backdrop;
    const t = d > 0 ? d / (255 - backdrop || 1) : d / (backdrop || 1);
    tone[i] = Math.abs(t) < NOISE_FLOOR ? 0 : t;
  }
  const scale = toneScale(tone);
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < tone.length; i++) {
    const t = Math.min(1, Math.abs(tone[i]) / scale) * TONE_STRENGTH;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = wash[c] + (ink[c] - wash[c]) * t;
  }
  return { out, width, height, rows: contentRows(tone, width, height) };
}

// Silhouettes dissolve into the wash over these shares of the art's own height, measured from where the
// art starts and stops (not the image edge), so a painted ground line can't end in a hard edge: a short fade at
// the top (behind the header's pills) and a longer one at the bottom, where figures stand
const FADE_TOP = 0.15;
const FADE_BOTTOM = 0.35;

function fadeEdges(pixels: Buffer, width: number, height: number, wash: number[], art: [number, number]) {
  const span = Math.max(1, art[1] - art[0]);
  const top = span * FADE_TOP, bottom = span * FADE_BOTTOM;
  for (let y = 0; y < height; y++) {
    const keep = Math.max(0, Math.min(1, (y - art[0]) / top, (art[1] - y) / bottom));
    if (keep >= 1) continue;
    const eased = keep * keep * (3 - 2 * keep);
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * width + x) * 3 + c;
        pixels[i] = wash[c] + (pixels[i] - wash[c]) * eased;
      }
    }
  }
  return pixels;
}

/** Any strip art, generated, uploaded or an earlier strip being repainted: recoloured to faint ink on the wash,
 *  cropped to its silhouettes, wide and low, with its top and bottom edges dissolving into the wash */
export async function prepareStrip(image: Buffer, theme: HeroTheme) {
  const wash = rgb(theme.background) ?? [248, 250, 252];
  const { out, width, height, rows } = await tonal(image, wash, rgb(theme.title) ?? [15, 23, 42]);
  const pad = Math.round(height * STRIP_PADDING);
  const top = Math.max(0, rows[0] - pad);
  const stripHeight = Math.min(height - top, rows[1] + pad - top, Math.round(width * MAX_STRIP_ASPECT));
  const strip = await sharp(out, { raw: { width, height, channels: 3 } })
    .extract({ left: 0, top, width, height: stripHeight })
    .resize(STRIP_WIDTH)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = strip.info;
  const scale = h / stripHeight;
  const art: [number, number] = [(rows[0] - top) * scale, Math.min(h, (rows[1] - top) * scale)];
  return sharp(fadeEdges(strip.data, w, h, wash, art), { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 82 }).toBuffer();
}

// Share of border pixels that sit on the backdrop's grey
async function flatBorderShare(image: Buffer) {
  const { data, info } = await sharp(image).flatten({ background: GREY_BACKDROP }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const backdrop = backdropLevel(data, info.width, info.height);
  let flat = 0, total = 0;
  const visit = (i: number) => { total++; if (Math.abs(data[i] - backdrop) <= FLAT_TOLERANCE) flat++; };
  for (let x = 0; x < info.width; x += 4) { visit(x); visit((info.height - 1) * info.width + x); }
  for (let y = 0; y < info.height; y += 4) { visit(y * info.width); visit(y * info.width + info.width - 1); }
  return flat / total;
}

async function renderStrip(scene: string) {
  return generate([
    "A wide, low decorative silhouette strip for a festive shopping app, spanning the full width of the image.",
    `Scene: ${scene}`,
    "Flat silhouettes only, like layered paper cut-outs: shapes in several shades of grey, from light grey to charcoal,",
    "with lighter shapes in the background and darker ones in front, some motifs (string lights, stars, petals) spread",
    "thinly across the whole width so it feels airy. Keep the composition in a horizontal band through the middle half,",
    "low and sparse through the left half, where a greeting will be written over it, with the tallest motifs towards the right.",
    `The background is a perfectly flat, uniform ${GREY_BACKDROP} grey with no gradient, vignette, texture, frame or shadow.`,
    "No colour other than greys, no text, letters, numbers or logos, no photographic detail.",
  ].join("\n"), "1536x1024", false);
}

/** The silhouette strip behind the header's pills and the greeting, in faint ink on the wash; repainted once if the
 *  model's backdrop isn't flat */
export async function paintStrip(scene: string, theme: HeroTheme) {
  let image = await renderStrip(scene);
  for (let attempt = 1; attempt < ATTEMPTS && (await flatBorderShare(image)) < MIN_FLAT_BORDER; attempt++) {
    image = await renderStrip(scene);
  }
  return prepareStrip(image, theme);
}

/** Any tile illustration, generated or uploaded, trimmed of empty margins so it fills its card. */
export function prepareTileArt(image: Buffer) {
  return sharp(image).trim().resize(TILE_SIZE, TILE_SIZE, { fit: "inside" }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
}

async function renderTileArt(items: string) {
  return generate([
    `A tight, cohesive cluster of ${items}, arranged as one appealing group for a shopping-category tile.`,
    "Glossy, realistic product-illustration style with soft studio light and a gentle contact shadow.",
    "Isolated objects on a fully transparent background: no backdrop, glow, smoke, or haze.",
    "No text, letters, logos, brand packaging, or people.",
  ].join("\n"), "1024x1024", true);
}

async function transparentShare(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (const alpha of data) if (alpha < 16) clear++;
  return clear / (info.width * info.height);
}

/** A tile's cut-out illustration, repainted once if the model returns it on an opaque backdrop. */
export async function paintTile(items: string) {
  let image = await renderTileArt(items);
  for (let attempt = 1; attempt < ATTEMPTS && (await transparentShare(image)) < MIN_TRANSPARENT_SHARE; attempt++) {
    image = await renderTileArt(items);
  }
  return prepareTileArt(image);
}

export async function uploadHeroArt(image: Buffer, slug: string, part: string) {
  const { url } = await putObject(`banners/seasonal/hero/${slug}-${part}-${randomUUID()}.webp`, image, "image/webp");
  return url;
}
