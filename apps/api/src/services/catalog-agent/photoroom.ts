import sharp from "sharp";
import { normalise } from "./photos.js";
import { flatUsage, type UsageEntry } from "./usage.js";

const SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";
const EDIT_URL = "https://image-api.photoroom.com/v2/edit";
// Plan prices: Remove Background (Basic) and Image Editing (Plus), per image
const SEGMENT_USD = 0.02;
const EDIT_USD = 0.1;
// Leans smaller than this aren't visible; larger ones are deliberate (a pack lying down, an angled hero shot)
const MIN_TILT_DEG = 1;
const MAX_TILT_DEG = 15;
// A nearly round cut-out (a tin seen from above) has no reliable long axis
const MIN_ELONGATION = 1.3;
const SIZE = 1024;

export class PhotoroomError extends Error {}

async function post(url: string, form: FormData, headers: Record<string, string> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": process.env.PHOTOROOM_API_KEY ?? "", ...headers }, body: form });
  if (!res.ok) throw new PhotoroomError(`Photoroom HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

const jpegBlob = (image: Buffer) => new Blob([new Uint8Array(image)], { type: "image/jpeg" });

/** How far the product's long axis leans from upright (or level), in degrees, from its cut-out mask */
export function measureTilt(alpha: Buffer, width: number, height: number, channels: number) {
  let mass = 0, sx = 0, sy = 0;
  for (let i = 0; i < width * height; i++) {
    const a = alpha[i * channels + channels - 1] / 255;
    mass += a; sx += a * (i % width); sy += a * Math.floor(i / width);
  }
  const cx = sx / mass, cy = sy / mass;
  let mu20 = 0, mu02 = 0, mu11 = 0;
  for (let i = 0; i < width * height; i++) {
    const a = alpha[i * channels + channels - 1] / 255;
    const dx = (i % width) - cx, dy = Math.floor(i / width) - cy;
    mu20 += a * dx * dx; mu02 += a * dy * dy; mu11 += a * dx * dy;
  }
  const axis = (0.5 * Math.atan2(2 * mu11, mu20 - mu02) * 180) / Math.PI;
  const spread = Math.sqrt((mu20 - mu02) ** 2 + 4 * mu11 ** 2);
  return {
    // Signed lean from the nearest of vertical/horizontal, in sharp's rotate() direction
    degrees: (((axis % 90) + 135) % 90) - 45,
    elongation: (mu20 + mu02 + spread) / Math.max(mu20 + mu02 - spread, 1e-9),
  };
}

/** Full-size cut-out of the subject on a transparent background, as PNG */
export async function photoroomCutout(image: Buffer): Promise<Buffer> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(image)], { type: "image/png" }), "image.png");
  return post(SEGMENT_URL, form);
}

/** Rotates a leaning product upright, using a low-resolution cut-out to find its axis */
async function straighten(photo: Buffer) {
  const form = new FormData();
  form.append("image_file", jpegBlob(photo), "photo.jpg");
  form.append("size", "preview");
  const mask = await post(SEGMENT_URL, form);
  const { data, info } = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tilt = measureTilt(data, info.width, info.height, info.channels);
  const lean = Math.abs(tilt.degrees);
  const upright = tilt.elongation >= MIN_ELONGATION && lean >= MIN_TILT_DEG && lean <= MAX_TILT_DEG;
  const image = upright ? await sharp(photo).rotate(-tilt.degrees, { background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer() : photo;
  return { image, degrees: upright ? tilt.degrees : 0 };
}

/** Straightened, relit packshot on white with a short, light contact shadow; the label is never redrawn */
export async function photoroomPackshot(photo: Buffer): Promise<{ image: Buffer; usage: UsageEntry[] }> {
  const { image: upright } = await straighten(await normalise(photo, 2048));
  const form = new FormData();
  form.append("imageFile", jpegBlob(upright), "photo.jpg");
  const fields = {
    "background.color": "FFFFFF",
    "lighting.mode": "ai.auto",
    "shadow.mode": "ai.auto-with-overrides",
    "shadow.intensityOverride": "0.45",
    "shadow.spreadOverride": "short",
    padding: "0.1",
    outputSize: `${SIZE}x${SIZE}`,
  };
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const image = await post(EDIT_URL, form, { "pr-ai-shadows-model-version": "2026-04-15" });
  return { image, usage: [flatUsage("straighten", "photoroom-segment", SEGMENT_USD), flatUsage("render", "photoroom", EDIT_USD)] };
}
