import { createHash } from "node:crypto";
import sharp from "sharp";
import { putObject } from "../media.js";
import { ART, packLayout } from "./layout.js";
import type { Pack } from "./pick.js";

// Bump when the layout changes, so every tile is drawn again
const LAYOUT_VERSION = 1;

/** The cache key of a pair's tile: its two cutouts, the layout, and whether the tile is square */
export const tileKey = ([back, front]: [Pack, Pack], square = false) =>
  createHash("sha1").update(`${LAYOUT_VERSION}|${back.url}|${front.url}${square ? "|square" : ""}`).digest("hex").slice(0, 24);

async function packImage(pack: Pack, size: { width: number; height: number }) {
  const res = await fetch(pack.url);
  if (!res.ok) throw new Error(`Pack cutout ${pack.url} returned ${res.status}`);
  return sharp(Buffer.from(await res.arrayBuffer())).resize(size.width, size.height, { fit: "fill" }).png().toBuffer();
}

/** Draws the pair onto a transparent tile, back pack first, and stores it; returns its public URL. A square tile
 * (Home's department grid, which fills its square) gets equal margins at the sides. */
export async function composeTile(pair: [Pack, Pack], square = false) {
  const layout = packLayout(pair[0].aspect, pair[1].aspect);
  const [back, front] = await Promise.all([packImage(pair[0], layout.back), packImage(pair[1], layout.front)]);
  const side = square ? (ART.height - ART.width) / 2 : 0;
  const tile = await sharp({ create: { width: ART.width + 2 * side, height: ART.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: back, left: side + layout.back.left, top: layout.back.top },
      { input: front, left: side + layout.front.left, top: layout.front.top },
    ])
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  const { url } = await putObject(`catalog/pack-tiles/${tileKey(pair, square)}.webp`, tile, "image/webp");
  return url;
}
