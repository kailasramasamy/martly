import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { putObject } from "../media.js";
import { BannerArtError } from "./banner-art.js";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const BACKGROUND_WIDTH = 768;
const BACKGROUND_HEIGHT = 1152;
const TILE_SIZE = 512;
// The app fades the artwork into a solid colour sampled from this bottom band, so the seam disappears
const EDGE_BAND = 0.08;
// The headline sits centred under the ornament, so only the middle of the artwork decides how deep it hangs.
// The wash drifts a little towards the bottom edge, so ornament is judged against the wash just below it
const HEADLINE_BAND = { from: 0.2, to: 0.8 };
const ORNAMENT_LIMIT = 0.6;
const WASH_BAND = { from: 0.6, to: 0.7 };
const SAMPLE_WIDTH = 96;
const ORNAMENT_DISTANCE = 48;
// Self-checks so festivals go live without anyone eyeballing the art: deeper ornament would push the tiles
// below the fold, a mostly opaque tile means the model ignored the transparent background
const MAX_ORNAMENT_DEPTH = 0.4;
const MIN_TRANSPARENT_SHARE = 0.15;
const ATTEMPTS = 2;
const MIN_CONTRAST = 4.5;


export interface HeroTheme {
  background: string;
  title: string;
  dark: boolean;
  /** Fraction of the artwork's height the ornament hangs down over the headline's column */
  ornamentDepth: number;
}

async function generate(prompt: string, size: "1024x1024" | "1024x1536", transparent: boolean) {
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

async function renderHeroBackground(scene: string, washColor: string) {
  const image = await generate([
    "A tall decorative festive background for the top of a premium Indian grocery delivery app's home screen.",
    `Ornamentation: ${scene}`,
    "Flat, premium vector-style illustration. Keep the ornament in the top quarter and along the very top corners;",
    `everything below fades into a smooth, plain, even wash of ${washColor} that reaches the bottom edge untouched,`,
    "because headline text and shopping tiles sit on it. No text, letters, numbers, logos or people anywhere.",
  ].join("\n"), "1024x1536", false);
  return sharp(image).resize(BACKGROUND_WIDTH, BACKGROUND_HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
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
  return sharp(image).trim().resize(TILE_SIZE, TILE_SIZE, { fit: "inside" }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
}

/** The hero background and its theme, repainted once if the ornament hangs so deep the tiles would sink. */
export async function paintBackground(scene: string, washColor: string, titleColor: string) {
  let best: { image: Buffer; theme: HeroTheme } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS && (!best || best.theme.ornamentDepth > MAX_ORNAMENT_DEPTH); attempt++) {
    const image = await renderHeroBackground(scene, washColor);
    const theme = await heroTheme(image, titleColor);
    if (!best || theme.ornamentDepth < best.theme.ornamentDepth) best = { image, theme };
  }
  return { image: best!.image, theme: { ...best!.theme, ornamentDepth: Math.min(best!.theme.ornamentDepth, MAX_ORNAMENT_DEPTH) } };
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

// The designer's headline colour when it reads clearly on the measured wash, otherwise a safe ink
function headlineColor(wash: number[], proposed: string, dark: boolean) {
  const color = rgb(proposed);
  if (color && contrast(color, wash) >= MIN_CONTRAST) return hex(color);
  return dark ? "#ffffff" : "#3b0d0d";
}

function hex(channels: number[]) {
  return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function bandMean(data: Buffer, width: number, rows: [number, number], cols: [number, number]) {
  const sum = [0, 0, 0];
  for (let y = rows[0]; y < rows[1]; y++) {
    for (let x = cols[0]; x < cols[1]; x++) for (let c = 0; c < 3; c++) sum[c] += data[(y * width + x) * 3 + c];
  }
  const n = (rows[1] - rows[0]) * (cols[1] - cols[0]);
  return sum.map((v) => v / n);
}

// The lowest row in the headline's column (within the top of the artwork) that still differs clearly from the wash
async function ornamentDepth(background: Buffer) {
  const { data, info } = await sharp(background).resize(SAMPLE_WIDTH).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols: [number, number] = [Math.floor(info.width * HEADLINE_BAND.from), Math.ceil(info.width * HEADLINE_BAND.to)];
  const wash = bandMean(data, info.width, [Math.floor(info.height * WASH_BAND.from), Math.floor(info.height * WASH_BAND.to)], cols);
  let deepest = 0;
  for (let y = 0; y < Math.floor(info.height * ORNAMENT_LIMIT); y++) {
    for (let x = cols[0]; x < cols[1]; x++) {
      const i = (y * info.width + x) * 3;
      if (Math.hypot(data[i] - wash[0], data[i + 1] - wash[1], data[i + 2] - wash[2]) > ORNAMENT_DISTANCE) {
        deepest = y + 1;
        break;
      }
    }
  }
  return Math.round((deepest / info.height) * 1000) / 1000;
}

/** Samples the fade colour, a legible headline colour, and how far down the headline can start. */
async function heroTheme(background: Buffer, titleColor: string): Promise<HeroTheme> {
  const band = Math.round(BACKGROUND_HEIGHT * EDGE_BAND);
  const { channels } = await sharp(background)
    .extract({ left: 0, top: BACKGROUND_HEIGHT - band, width: BACKGROUND_WIDTH, height: band })
    .stats();
  const wash = channels.slice(0, 3).map((c) => c.mean);
  const dark = luminance(wash) < 0.3;
  return { background: hex(wash), title: headlineColor(wash, titleColor, dark), dark, ornamentDepth: await ornamentDepth(background) };
}

export async function uploadHeroArt(image: Buffer, slug: string, part: string) {
  const { url } = await putObject(`banners/seasonal/hero/${slug}-${part}-${randomUUID()}.webp`, image, "image/webp");
  return url;
}
