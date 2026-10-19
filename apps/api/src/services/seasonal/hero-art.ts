import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";
import { BannerArtError } from "./banner-art.js";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const STRIP_WIDTH = 1200;
const TILE_SIZE = 512;
// Silhouettes are painted on this flat grey; the recolour maps it to exactly the theme colour, so the strip
// melts into the solid bands above (header, search) and below (tiles) with no seam
const GREY_BACKDROP = "#808080";
// Tones are the theme colour pushed at most this far towards white (lighter shapes) or black (darker shapes)
const TONE_STRENGTH = 0.62;
// Brightness this close to the backdrop is noise from the model, not a shape, and stays the theme colour
const NOISE_FLOOR = 0.06;
const STRIP_PADDING = 0.06;
// The greeting is set over the strip, so it keeps enough height for three lines of text
const MAX_STRIP_ASPECT = 1 / 1.9;
const MIN_TRANSPARENT_SHARE = 0.15;
// Self-check for strips: most of the painting's border must be the flat grey backdrop, otherwise the model painted
// a vignette or gradient that would tint the whole strip, and it is repainted once
const MIN_FLAT_BORDER = 0.8;
const FLAT_TOLERANCE = 10;
const ATTEMPTS = 2;
// White text must stay readable on the theme colour, but a colour far darker than that just looks heavy, so a
// rich colour is nudged into this band: deepened if too light for white text, lifted if needlessly dark
const MIN_CONTRAST = 3.8;
const MAX_CONTRAST = 4.6;
const STEP = 0.06;
// Lifting stops after this much lightness, so a deep colour gets a little lighter, not a different colour
const MAX_LIFT = 0.1;

/** The festive block's colours: one solid theme colour from the status bar to the tiles, and its text colour */
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

function luminance([r, g, b]: number[]) {
  const linear = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgb(hexColor: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexColor.trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
}

function hex(channels: number[]) {
  return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

const WHITE = [255, 255, 255];

function toHsl([r, g, b]: number[]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [hue / 6, sat, l];
}

function fromHsl([h, sat, l]: [number, number, number]): number[] {
  if (sat === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
  const channel = (t: number) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return v * 255;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** White text on the theme colour: the colour's lightness (hue and saturation kept) moved until white reads
 *  clearly on it without the colour looking heavy */
export function stripTheme(proposed: string): HeroTheme {
  const [h, sat, start] = toHsl(rgb(proposed) ?? [24, 110, 70]);
  let l = start;
  while (l > 0 && contrast(WHITE, fromHsl([h, sat, l])) < MIN_CONTRAST) l -= STEP / 3;
  const ceiling = Math.max(l, start + MAX_LIFT);
  while (l + STEP / 3 <= ceiling && contrast(WHITE, fromHsl([h, sat, l])) > MAX_CONTRAST
    && contrast(WHITE, fromHsl([h, sat, l + STEP / 3])) >= MIN_CONTRAST) l += STEP / 3;
  return { background: hex(fromHsl([h, sat, l])), title: "#ffffff", dark: true };
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

/** Turns grey silhouettes into lighter and darker tones of the theme colour on exactly the theme colour */
async function tonal(image: Buffer, theme: number[]) {
  const { data, info } = await sharp(image).flatten({ background: GREY_BACKDROP }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const backdrop = backdropLevel(data, width, height);
  const tone = new Float32Array(width * height);
  for (let i = 0; i < tone.length; i++) {
    const d = data[i] - backdrop;
    const t = d > 0 ? d / (255 - backdrop || 1) : d / (backdrop || 1);
    tone[i] = Math.abs(t) < NOISE_FLOOR ? 0 : t;
  }
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < tone.length; i++) {
    const t = tone[i] * TONE_STRENGTH;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = t >= 0 ? theme[c] + (255 - theme[c]) * t : theme[c] * (1 + t);
  }
  return { out, width, height, rows: contentRows(tone, width, height) };
}

// Silhouettes dissolve into the theme colour over these shares of the art's own height, measured from where the
// art starts and stops (not the image edge), so a painted ground line can't end in a hard edge: a short fade at
// the top (the search bar's band) and a longer one at the bottom, where figures stand
const FADE_TOP = 0.15;
const FADE_BOTTOM = 0.35;

function fadeEdges(pixels: Buffer, width: number, height: number, theme: number[], art: [number, number]) {
  const span = Math.max(1, art[1] - art[0]);
  const top = span * FADE_TOP, bottom = span * FADE_BOTTOM;
  for (let y = 0; y < height; y++) {
    const keep = Math.max(0, Math.min(1, (y - art[0]) / top, (art[1] - y) / bottom));
    if (keep >= 1) continue;
    const eased = keep * keep * (3 - 2 * keep);
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * width + x) * 3 + c;
        pixels[i] = theme[c] + (pixels[i] - theme[c]) * eased;
      }
    }
  }
  return pixels;
}

/** Any strip art, generated or uploaded: recoloured to the theme, cropped to its silhouettes, wide and low, with
 *  its top and bottom edges dissolving into the theme colour */
export async function prepareStrip(image: Buffer, themeColor: string) {
  const theme = rgb(themeColor) ?? [24, 110, 70];
  const { out, width, height, rows } = await tonal(image, theme);
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
  return sharp(fadeEdges(strip.data, w, h, theme, art), { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 82 }).toBuffer();
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
    "tallest at the left and right ends and calmer, lower and lighter through the centre, where a greeting will be written over it.",
    `The background is a perfectly flat, uniform ${GREY_BACKDROP} grey with no gradient, vignette, texture, frame or shadow.`,
    "No colour other than greys, no text, letters, numbers or logos, no photographic detail.",
  ].join("\n"), "1536x1024", false);
}

/** The silhouette strip between the search bar and the tiles, in tones of the theme colour; repainted once if the
 *  model's backdrop isn't flat */
export async function paintStrip(scene: string, themeColor: string) {
  let image = await renderStrip(scene);
  for (let attempt = 1; attempt < ATTEMPTS && (await flatBorderShare(image)) < MIN_FLAT_BORDER; attempt++) {
    image = await renderStrip(scene);
  }
  return prepareStrip(image, themeColor);
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
