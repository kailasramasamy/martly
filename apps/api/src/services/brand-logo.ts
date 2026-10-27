import sharp from "sharp";
import { PhotoroomError, photoroomCutout } from "./catalog-agent/photoroom.js";

// Logos show at most a few dozen points wide; 512px stays sharp at 3x
const MAX_SIZE = 512;
// Pixels this washed-out, dark or light are outlines and backgrounds, not the brand's colour
const MIN_SATURATION = 0.25;
const MIN_LIGHTNESS = 0.12;
const MAX_LIGHTNESS = 0.92;
// Below this share of coloured pixels, the logo is black/grey and only gets a brand colour
const MIN_COLOURED_SHARE = 0.05;
// Colours closer than this (RGB distance) are one colour
const MERGE_DISTANCE = 60;
// The accent is its own colour family, not a tint of the brand colour left by anti-aliased edges
const ACCENT_MIN_HUE_GAP = 25;
const ACCENT_MIN_SATURATION = 0.35;
const ACCENT_MAX_LIGHTNESS = 0.8;
const MIN_ACCENT_SHARE = 0.03;
// A logo with this much see-through area already has no background to remove
const TRANSPARENT_SHARE = 0.05;

type Rgb = [number, number, number];
interface Cluster { sum: Rgb; count: number }

/** What happened to the background: removed by Photoroom, already transparent, or kept as uploaded */
export type LogoBackground = "removed" | "transparent" | "kept";

export interface CleanLogo {
  image: Buffer;
  themeColor: string | null;
  themeColorSecondary: string | null;
  background: LogoBackground;
}

const mean = (c: Cluster): Rgb => c.sum.map((v) => v / c.count) as Rgb;
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function hsl([r, g, b]: Rgb) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === rn ? 60 * (((gn - bn) / d + 6) % 6) : max === gn ? 60 * ((bn - rn) / d + 2) : 60 * ((rn - gn) / d + 4);
  return { h, s, l };
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function isAccent(candidate: Rgb, brand: Rgb) {
  const c = hsl(candidate);
  return c.s >= ACCENT_MIN_SATURATION && c.l <= ACCENT_MAX_LIGHTNESS && hueGap(c.h, hsl(brand).h) >= ACCENT_MIN_HUE_GAP;
}

function addTo(clusters: Cluster[], rgb: Rgb) {
  const near = clusters.find((c) => distance(mean(c), rgb) < MERGE_DISTANCE);
  if (near) { near.sum = near.sum.map((v, i) => v + rgb[i]) as Rgb; near.count++; }
  else clusters.push({ sum: [...rgb], count: 1 });
}

/** Brand colour = the logo's most common strong colour; accent = the next common colour from a different family */
export async function logoColours(image: Buffer): Promise<{ themeColor: string | null; themeColorSecondary: string | null }> {
  const { data, info } = await sharp(image).resize(96, 96, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const coloured: Cluster[] = [];
  const dark: Cluster = { sum: [0, 0, 0], count: 0 };
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    opaque++;
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
    const { s, l } = hsl(rgb);
    if (s >= MIN_SATURATION && l >= MIN_LIGHTNESS && l <= MAX_LIGHTNESS) addTo(coloured, rgb);
    else if (l < 0.5) { dark.sum = dark.sum.map((v, k) => v + rgb[k]) as Rgb; dark.count++; }
  }
  const colouredCount = coloured.reduce((n, c) => n + c.count, 0);
  if (opaque === 0 || colouredCount / opaque < MIN_COLOURED_SHARE) {
    return { themeColor: dark.count ? hex(mean(dark)) : null, themeColorSecondary: null };
  }
  const [brand, ...rest] = coloured.sort((a, b) => b.count - a.count);
  const accent = rest.find((c) => c.count / colouredCount >= MIN_ACCENT_SHARE && isAccent(mean(c), mean(brand)));
  return { themeColor: hex(mean(brand)), themeColorSecondary: accent ? hex(mean(accent)) : null };
}

async function isTransparent(image: Buffer): Promise<boolean> {
  const { data, info } = await sharp(image).resize(96, 96, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = info.channels - 1; i < data.length; i += info.channels) if (data[i] < 16) clear++;
  return clear / (info.width * info.height) >= TRANSPARENT_SHARE;
}

async function removeBackground(original: Buffer, wanted: boolean): Promise<{ cut: Buffer; background: LogoBackground }> {
  if (await isTransparent(original)) return { cut: original, background: "transparent" };
  if (!wanted) return { cut: original, background: "kept" };
  try {
    return { cut: await photoroomCutout(original), background: "removed" };
  } catch (err) {
    if (!(err instanceof PhotoroomError)) throw err;
    return { cut: original, background: "kept" };
  }
}

/** Cuts the empty or plain margins down to the mark, edge to edge like brand logos, capped at MAX_SIZE as WebP */
export async function trimLogo(logo: Buffer): Promise<Buffer> {
  return sharp(logo).rotate().trim()
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}

/** Trims the logo to its mark and reads its colours; removes an opaque background (Photoroom) when asked */
export async function cleanLogo(upload: Buffer, removeBg: boolean): Promise<CleanLogo> {
  const original = await sharp(upload).rotate().png().toBuffer();
  const { cut, background } = await removeBackground(original, removeBg);
  const image = await trimLogo(cut);
  return { image, background, ...(await logoColours(image)) };
}
