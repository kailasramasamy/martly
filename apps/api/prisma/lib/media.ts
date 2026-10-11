// S3 uploads for seed/import scripts. Keys carry a content hash so a changed image never hits a stale cache.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { createHash } from "node:crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Uploads an image under `<keyBase>-<hash>.<format>` and returns its public URL
export async function uploadImage(keyBase: string, body: Buffer, format: "webp" | "png" = "webp"): Promise<string> {
  const prefix = process.env.S3_KEY_PREFIX ? `${process.env.S3_KEY_PREFIX}/` : "";
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8);
  const key = `${prefix}${keyBase}-${hash}.${format}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: body,
    ContentType: `image/${format}`,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${process.env.MEDIA_PUBLIC_BASE_URL}/${key}`;
}

// Background = near-white pixels connected to the image border (so white artwork inside the logo is kept).
// Those become fully transparent; light edge pixels next to them get partial alpha to keep anti-aliasing smooth.
export async function transparentLogoPng(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const lightness = (i: number) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const isBackground = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
  while (queue.length) {
    const i = queue.pop()!;
    if (isBackground[i] || lightness(i) < 235) continue;
    isBackground[i] = 1;
    const x = i % width;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (i >= width) queue.push(i - width);
    if (i < width * (height - 1)) queue.push(i + width);
  }
  const touchesBackground = (i: number) => {
    const x = i % width;
    return (x > 0 && isBackground[i - 1]) || (x < width - 1 && isBackground[i + 1])
      || (i >= width && isBackground[i - width]) || (i < width * (height - 1) && isBackground[i + width]);
  };
  for (let i = 0; i < width * height; i++) {
    if (isBackground[i]) { data[i * 4 + 3] = 0; continue; }
    if (!touchesBackground(i)) continue;
    // Edge pixel blended with white: alpha from how far it is from white, then un-blend the colour
    const alpha = Math.max(0.05, (255 - lightness(i)) / 255);
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(Math.max(0, (data[i * 4 + c] - 255 * (1 - alpha)) / alpha));
    data[i * 4 + 3] = Math.round(alpha * 255);
  }
  return sharp(data, { raw: info }).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
}
