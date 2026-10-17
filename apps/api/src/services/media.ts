import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const REGION = process.env.AWS_REGION ?? "ap-south-1";
const BUCKET = process.env.S3_BUCKET ?? "martly-media";
// Empty prefix means objects live at the bucket root; strip stray slashes so
// the key never starts with "/" (which S3 treats as an unnamed folder).
const KEY_PREFIX = (process.env.S3_KEY_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
const BASE_URL =
  process.env.MEDIA_PUBLIC_BASE_URL ??
  `https://${BUCKET}.s3.${REGION}.amazonaws.com${KEY_PREFIX ? `/${KEY_PREFIX}` : ""}`;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const OPTIMIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_WIDTH = 1600;

/** Uploads under the configured prefix and returns the object's key and public URL. Every key is unique, so clients may cache forever. */
export async function putObject(name: string, body: Buffer, contentType: string) {
  const key = KEY_PREFIX ? `${KEY_PREFIX}/${name}` : name;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, url: `${BASE_URL}/${name}` };
}

/** True for URLs of objects this API uploaded, so server-side fetches never follow a user-supplied URL elsewhere */
export function isMediaUrl(url: string) {
  return url.startsWith(`${BASE_URL}/`);
}

/** True for raster photos worth re-encoding; SVG, GIF and non-images pass through as uploaded */
export function isOptimizableImage(contentType: string) {
  return OPTIMIZABLE_TYPES.has(contentType);
}

/** Re-encodes a raster photo as WebP no wider than 1600px, keeping transparency and applying EXIF rotation */
export function optimizeImage(body: Buffer) {
  return sharp(body).rotate().resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
