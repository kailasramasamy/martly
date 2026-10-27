import sharp from "sharp";
import type { PackTemplate } from "./templates.js";

const INK_OPACITY = 0.98;
const GLOSS_STRENGTH = 0.85;
// Soft shadow so the cut-out pouch sits on the page like a photo: a faint drop shadow plus a contact shadow at the floor
const DROP_OFFSET = 12;
const DROP_OPACITY = 0.2;
const CONTACT_OPACITY = 0.45;

// A curved surface seen head-on: print near the bulging edges is foreshortened (cylinder projection)
const unwrap = (t: number, k: number) => (k ? Math.asin(t * k) / Math.asin(k) : t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

async function loadLayers(photo: Buffer, art: Buffer, t: PackTemplate) {
  const raw = (img: sharp.Sharp) => img.raw().toBuffer();
  const outline = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}"><path d="${t.path}" fill="#fff"/></svg>`;
  const [base, alpha, shade, ink, mask] = await Promise.all([
    raw(sharp(photo).removeAlpha()),
    raw(sharp(photo).ensureAlpha().extractChannel(3)),
    raw(sharp(photo).flatten({ background: "#ffffff" }).greyscale().blur(25)),
    raw(sharp(art).resize(t.face.w, t.face.h, { fit: "fill" }).blur(0.6).ensureAlpha()),
    raw(sharp(Buffer.from(outline)).greyscale().blur(1.2)),
  ]);
  return { base, alpha, shade, ink, mask };
}

/** Index into the flat artwork for a photo pixel, or -1 outside the printed face */
function artIndex(x: number, y: number, t: PackTemplate) {
  const { face, curve } = t;
  const tx = ((x - face.x) / face.w) * 2 - 1;
  const ty = ((y - face.y) / face.h) * 2 - 1;
  if (tx < -1 || tx > 1 || ty < -1 || ty > 1) return -1;
  const u = Math.min(face.w - 1, Math.round(((unwrap(tx, curve.x) + 1) / 2) * (face.w - 1)));
  const v = Math.min(face.h - 1, Math.round(((unwrap(ty, curve.y) + 1) / 2) * (face.h - 1)));
  return (v * face.w + u) * 4;
}

/** Lighting falls off toward the pouch edges; returns the blurred photo's range inside the outline */
function lightRange(shade: Buffer, mask: Buffer) {
  let lo = 255, hi = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 250) continue;
    lo = Math.min(lo, shade[i]);
    hi = Math.max(hi, shade[i]);
  }
  return { lo, span: Math.max(1, hi - lo) };
}

/** Shadow under the pouch as an RGBA layer: black, with the shadow's strength in alpha */
async function shadowLayer(alpha: Buffer, t: PackTemplate) {
  const { width: W, height: H, floor } = t;
  const contactSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%"/>`
    + `<ellipse cx="${(floor.x1 + floor.x2) / 2}" cy="${floor.y}" rx="${(floor.x2 - floor.x1) / 2}" ry="14" fill="#fff"/></svg>`;
  const [drop, contact] = await Promise.all([
    // blur() hands back sRGB; keep one band
    sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(18).extractChannel(0).raw().toBuffer(),
    sharp(Buffer.from(contactSvg)).greyscale().blur(10).raw().toBuffer(),
  ]);
  const layer = Buffer.alloc(W * H * 4);
  for (let i = DROP_OFFSET * W; i < W * H; i++) {
    layer[i * 4 + 3] = Math.min(255, Math.round(drop[i - DROP_OFFSET * W] * DROP_OPACITY + contact[i] * CONTACT_OPACITY));
  }
  return layer;
}

/** Prints flat artwork onto a pouch photo: clipped to the film, warped to its bulge, lit like the photo, under its gloss */
export async function printOnPouch(photo: Buffer, art: Buffer, t: PackTemplate) {
  const { base, alpha, shade, ink, mask } = await loadLayers(photo, art, t);
  const { lo, span } = lightRange(shade, mask);
  const out = Buffer.from(base);
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      const i = y * t.width + x;
      const q = mask[i] ? artIndex(x, y, t) : -1;
      if (q < 0) continue;
      const a = (ink[q + 3] / 255) * (mask[i] / 255) * INK_OPACITY;
      if (!a) continue;
      const p = i * 3;
      const light = 0.8 + (0.2 * (shade[i] - lo)) / span;
      const max = Math.max(base[p], base[p + 1], base[p + 2]);
      const sat = max ? (max - Math.min(base[p], base[p + 1], base[p + 2])) / max : 0;
      // Specular streaks on the film: bright and nearly colourless
      const gloss = clamp01((max / 255 - 0.8) / 0.2) * clamp01((0.22 - sat) / 0.22) * a * GLOSS_STRENGTH;
      for (let c = 0; c < 3; c++) {
        const printed = base[p + c] * (1 - a) + ink[q + c] * light * a;
        out[p + c] = Math.round(printed * (1 - gloss) + 255 * gloss);
      }
    }
  }
  const raw = { width: t.width, height: t.height, channels: 3 } as const;
  const pouch = await sharp(out, { raw }).joinChannel(alpha, { raw: { ...raw, channels: 1 } }).png().toBuffer();
  const shot = await sharp(await shadowLayer(alpha, t), { raw: { ...raw, channels: 4 } }).composite([{ input: pouch }]).png().toBuffer();
  return sharp(shot).extract(t.crop);
}
