import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

/** Uploads under the configured prefix and returns the object's key and public URL. */
export async function putObject(name: string, body: Buffer, contentType: string) {
  const key = KEY_PREFIX ? `${KEY_PREFIX}/${name}` : name;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return { key, url: `${BASE_URL}/${name}` };
}
