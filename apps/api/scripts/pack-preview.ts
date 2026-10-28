/**
 * Renders local pack artwork with the production pack renderer onto pouch photos, before the design is uploaded.
 *
 * Usage: cd apps/api && npx tsx scripts/pack-preview.ts <artwork.png> <zones.json> <out dir> <size> <pouch photo URL>…
 * e.g. size "1 kg"; each photo URL is a product's packPhotoUrl. Writes <out dir>/<photo name>.png on a white card.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import sharp from "sharp";
import { renderPack } from "../src/services/pack-render/index.js";

const [artPath, zonesPath, outDir, size, ...photos] = process.argv.slice(2);
if (!artPath || !zonesPath || !outDir || !size || !photos.length) {
  throw new Error("Usage: npx tsx scripts/pack-preview.ts <artwork.png> <zones.json> <out dir> <size> <pouch photo URL>…");
}
const design = {
  id: "preview",
  template: "pillow-1kg-full",
  frontArtUrl: `data:image/png;base64,${readFileSync(artPath).toString("base64")}`,
  backArtUrl: null,
  zones: JSON.parse(readFileSync(zonesPath, "utf8")),
  updatedAt: new Date(),
};
mkdirSync(outDir, { recursive: true });
for (const url of photos) {
  const product = { name: "Preview", ingredients: null, nutritionalInfo: null, translations: null, packPhotoUrl: url };
  const { front } = await renderPack(design, product, size);
  const file = join(outDir, `${basename(url).replace(/\.\w+$/, "")}.png`);
  writeFileSync(file, await sharp(front).flatten({ background: "#ffffff" }).png().toBuffer());
  console.log(file);
}
