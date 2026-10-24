// Prints flat pack artwork onto an AI photo of a blank clear pouch.
// usage: node compose.mjs <template> <artwork.png> <out.png> [photo.png]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(HERE, "../../apps/api/package.json"));
const sharp = require("sharp");

const [templateName, artPath, outPath, photoArg] = process.argv.slice(2);
const T = JSON.parse(readFileSync(resolve(HERE, "templates.json"), "utf8"))[templateName];
const photoPath = photoArg ?? resolve(HERE, T.photo);
const { face: FACE, curve: CURVE } = T;
const INK_OPACITY = 0.98;
const GLOSS_STRENGTH = 0.85;

const { width: W, height: H } = await sharp(photoPath).metadata();
const raw = (img) => img.raw().toBuffer();

const photo = await raw(sharp(photoPath).removeAlpha());
const shade = await raw(sharp(photoPath).removeAlpha().greyscale().blur(25));
const art = await raw(sharp(artPath).resize(FACE.w, FACE.h, { fit: "fill" }).blur(0.6).ensureAlpha());
const mask = await raw(
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${T.path}" fill="#fff"/></svg>`))
    .greyscale()
    .blur(1.2),
);

// A curved surface seen head-on: print near the bulging edges is foreshortened (cylinder projection)
const unwrap = (t, k) => (k ? Math.asin(t * k) / Math.asin(k) : t);

function sampleArt(x, y) {
  const tx = ((x - FACE.x) / FACE.w) * 2 - 1;
  const ty = ((y - FACE.y) / FACE.h) * 2 - 1;
  if (tx < -1 || tx > 1 || ty < -1 || ty > 1) return null;
  const u = Math.min(FACE.w - 1, Math.round(((unwrap(tx, CURVE.x) + 1) / 2) * (FACE.w - 1)));
  const v = Math.min(FACE.h - 1, Math.round(((unwrap(ty, CURVE.y) + 1) / 2) * (FACE.h - 1)));
  return (v * FACE.w + u) * 4;
}

// Lighting falls off toward the pouch edges; map the blurred photo's range onto 0.8–1.0
let lo = 255, hi = 0;
for (let i = 0; i < W * H; i++) {
  if (mask[i] < 250) continue;
  lo = Math.min(lo, shade[i]);
  hi = Math.max(hi, shade[i]);
}

const out = Buffer.from(photo);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const q = mask[i] ? sampleArt(x, y) : null;
    if (q === null) continue;
    const a = (art[q + 3] / 255) * (mask[i] / 255) * INK_OPACITY;
    if (!a) continue;
    const p = i * 3;
    const light = 0.8 + (0.2 * (shade[i] - lo)) / Math.max(1, hi - lo);
    const max = Math.max(photo[p], photo[p + 1], photo[p + 2]);
    const sat = max ? (max - Math.min(photo[p], photo[p + 1], photo[p + 2])) / max : 0;
    // Specular streaks on the film: bright and nearly colourless
    const spec = Math.max(0, Math.min(1, (max / 255 - 0.8) / 0.2)) * Math.max(0, Math.min(1, (0.22 - sat) / 0.22));
    const gloss = spec * a * GLOSS_STRENGTH;
    for (let c = 0; c < 3; c++) {
      const printed = photo[p + c] * (1 - a) + art[q + c] * light * a;
      out[p + c] = Math.round(printed * (1 - gloss) + 255 * gloss);
    }
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outPath);
