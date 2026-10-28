// Cuts a pouch photo out of its studio background. The filled body stays opaque; the clear crimp seals keep
// only what differs from the backdrop, so they read as film on any colour.
// usage: node cutout.mjs <template> <photo.png> <out.png>
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(HERE, "../../apps/api/package.json"));
const sharp = require("sharp");

const [templateName, photoPath, outPath] = process.argv.slice(2);
const { seals } = JSON.parse(readFileSync(resolve(HERE, "templates.json"), "utf8"))[templateName];
const FILM_RANGE = 34; // backdrop difference at which film counts as fully opaque
const FILM_MIN = 0.06; // faint tint so a plain seal still shows on white

// Bag silhouette: backdrop flood-filled from the edges, then the contact shadow below the bottom seal dropped
const silhouette = execFileSync("magick", [
  photoPath, "-alpha", "set", "-fuzz", "4%", "-fill", "none",
  ...[[0, 0], [1023, 0], [0, 1535], [1023, 1535]].flatMap(([x, y]) => ["-draw", `color ${x},${y} floodfill`]),
  "-alpha", "extract", "-fill", "black", "-draw", `rectangle 0,${seals.bottom[1] + 1} 1023,1535`, "-blur", "0x1", "png:-",
]);

const { data: rgb, info } = await sharp(photoPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const mask = await sharp(silhouette).greyscale().raw().toBuffer();
const { width: W, height: H } = info;
const out = Buffer.alloc(W * H * 4);
const inSeal = (y) => (y >= seals.top[0] && y <= seals.top[1]) || (y >= seals.bottom[0] && y <= seals.bottom[1]);

for (let y = 0; y < H; y++) {
  // The backdrop shades slowly top to bottom; sample it in the empty left margin of each row
  const bg = [0, 1, 2].map((c) => rgb[(y * W + 8) * 3 + c]);
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const p = [0, 1, 2].map((c) => rgb[i * 3 + c]);
    let a = mask[i] / 255;
    if (a && inSeal(y)) {
      const diff = Math.max(...p.map((v, c) => Math.abs(v - bg[c])));
      a *= Math.max(FILM_MIN, Math.min(1, diff / FILM_RANGE));
    }
    for (let c = 0; c < 3; c++) {
      // Un-mix the backdrop from see-through film so it composites cleanly over any colour
      out[i * 4 + c] = a ? Math.max(0, Math.min(255, Math.round(bg[c] + (p[c] - bg[c]) / Math.max(a, 1e-3)))) : 0;
    }
    out[i * 4 + 3] = Math.round(a * 255);
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath);
