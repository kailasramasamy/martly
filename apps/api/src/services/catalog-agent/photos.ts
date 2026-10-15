import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";

// Claude reads images up to ~1.15 MP at full detail; a longer edge only adds tokens
const CLAUDE_EDGE = 1568;

export class PhotoFetchError extends Error {}

export async function fetchPhoto(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new PhotoFetchError(`Couldn't download ${url} (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Upright JPEG no larger than the model reads at full detail */
export function normalise(photo: Buffer, edge = CLAUDE_EDGE) {
  return sharp(photo).rotate().flatten({ background: "#ffffff" }).resize(edge, edge, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

export async function imageBlock(photo: Buffer): Promise<Anthropic.Beta.BetaImageBlockParam> {
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await normalise(photo)).toString("base64") } };
}
