import "../src/load-env.js";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { generate } from "../src/services/seasonal/hero-art.js";
import { putObject } from "../src/services/media.js";

export type ArtSize = "1536x1024" | "1024x1024";

/** Generates one image with the house model (gpt-image-2.5-flare, medium quality) and uploads it as WebP; returns its URL. */
export async function paintArt(slug: string, prompt: string, size: ArtSize, transparent: boolean) {
  const image = await generate(prompt, size, transparent);
  // Cut-outs are trimmed to their objects, so they fill the card box they sit in
  const shaped = transparent ? sharp(image).trim().resize(1000, 1000, { fit: "inside" }) : sharp(image);
  const webp = await shaped.webp({ quality: 80, alphaQuality: 90 }).toBuffer();
  const { url } = await putObject(`home/${slug}-${randomUUID()}.webp`, webp, "image/webp");
  return url;
}

/** The art already stored for a section, so re-runs skip regenerating unless --regen-art is passed. */
export function reusableArt(previous: Record<string, unknown> | undefined, field: string) {
  if (process.argv.includes("--regen-art")) return undefined;
  const url = previous?.[field];
  return typeof url === "string" ? url : undefined;
}
