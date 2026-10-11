import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchEntry, LOGO_DIR, Overrides, prisma } from "./common.js";

const REGION = process.env.AWS_REGION ?? "ap-south-1";
const BUCKET = process.env.S3_BUCKET ?? "media-image-upload";
const KEY_PREFIX = process.env.S3_KEY_PREFIX ?? "martly";
const keyFor = (filename: string) => [KEY_PREFIX, filename].filter(Boolean).join("/");
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL ?? `https://${BUCKET}.s3.${REGION}.amazonaws.com/${KEY_PREFIX}`;

export function acceptedEntries(entries: FetchEntry[], overrides: Overrides): FetchEntry[] {
  return entries.filter((e) => e.file && overrides[e.name] !== null);
}

export async function applyLogos(entries: FetchEntry[], overrides: Overrides, dryRun: boolean): Promise<number> {
  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const accepted = acceptedEntries(entries, overrides);
  for (const e of accepted) {
    const filename = `brands/${e.slug}.png`;
    const url = `${BASE_URL}/${filename}`;
    console.log(`${dryRun ? "[dry-run] " : ""}${e.name} -> ${url}`);
    if (dryRun) continue;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: keyFor(filename),
        Body: readFileSync(join(LOGO_DIR, e.file!)),
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000",
      }),
    );
    await prisma.brand.update({ where: { id: e.brandId }, data: { imageUrl: url } });
  }
  return accepted.length;
}
