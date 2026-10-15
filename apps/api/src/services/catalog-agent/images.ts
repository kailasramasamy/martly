import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { randomUUID } from "crypto";
import * as z from "zod/v4";
import { putObject } from "../media.js";
import { MODEL } from "./extract.js";
import { imageBlock, normalise } from "./photos.js";
import { photoroomPackshot } from "./photoroom.js";
import { claudeUsage, imageUsage, type UsageEntry } from "./usage.js";

const IMAGE_MODEL = process.env.CATALOG_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const SIZE = 1024;

export type ImageProvider = "openai" | "photoroom";

export interface ProcessedShot {
  index: number;
  url: string;
  source: "openai" | "photoroom" | "plain";
  verdict: "pass" | "minor_only" | "fail" | null;
  differences: string[];
}

export function imageProvider(): ImageProvider {
  return process.env.CATALOG_IMAGE_PROVIDER === "photoroom" ? "photoroom" : "openai";
}

const RENDER_PROMPT = `Turn this phone photo into a professional e-commerce catalogue packshot of the exact same product.
Keep the product itself identical: same pack shape, colours, logo, artwork and every word, number and symbol of the label,
exactly as photographed. Do not redraw, translate, correct or invent any text. Keep the fill level of the contents as photographed.
Where small text is too blurry to read, keep it soft and blurry rather than guessing new words.
Remove the background, hands, shelves and reflections. Place the product upright and front-facing, centred on a pure white
(#FFFFFF) seamless background, filling about 80% of the frame, with soft even studio lighting and a subtle natural shadow beneath.`;

const VERIFY_SYSTEM = `You check an AI-retouched product packshot against the original phone photo of the same pack, for a grocery catalogue.
Read the text on the pack in BOTH images and compare word by word, number by number. Report only real differences:
changed, added, dropped or garbled words, numbers or symbols, a different logo, pack shape, colour or fill level.
Ignore background, lighting, shadow, straightening, and text that is unreadable in the original.
critical = brand, product name, claims ("high in", "no added"), quantities, nutrition values, FSSAI/licence numbers,
veg/non-veg mark, prices, ingredients, fill level or pack shape. minor = slogans, taglines, decorative or tiny text.
verdict: pass = no differences; minor_only = only minor ones; fail = any critical one.`;

const VerifySchema = z.object({
  differences: z.array(z.object({ original: z.string(), retouched: z.string(), severity: z.enum(["critical", "minor"]) })),
  verdict: z.enum(["pass", "minor_only", "fail"]),
});

export class ImageProviderError extends Error {}

async function renderOpenAI(photo: Buffer) {
  const res = await new OpenAI().images.edit({
    model: IMAGE_MODEL,
    image: await toFile(await normalise(photo, 1536), "photo.jpg", { type: "image/jpeg" }),
    prompt: RENDER_PROMPT,
    size: `${SIZE}x${SIZE}`,
    quality: "medium",
    output_format: "webp",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new ImageProviderError(`${IMAGE_MODEL} returned no image`);
  return { image: Buffer.from(b64, "base64"), usage: imageUsage("render", IMAGE_MODEL, res.usage) };
}

async function verifyRender(original: Buffer, render: Buffer) {
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: VERIFY_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(VerifySchema) },
    messages: [{
      role: "user",
      content: [{ type: "text", text: "Original photo:" }, await imageBlock(original), { type: "text", text: "Retouched packshot:" }, await imageBlock(render)],
    }],
  });
  const usage = claudeUsage("verify", MODEL, response.usage);
  // An unreadable check counts as a failed one: the plain photo is always safe
  const result = response.parsed_output ?? { differences: [], verdict: "fail" as const };
  return { result, usage };
}

/** No AI: upright, centred on a white square, auto-levelled. Never changes the label. */
function plainCleanup(photo: Buffer) {
  return sharp(photo).rotate().normalise().resize(SIZE, SIZE, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).toBuffer();
}

async function upload(draftId: string, index: number, image: Buffer) {
  const webp = await sharp(image).webp({ quality: 82 }).toBuffer();
  const { url } = await putObject(`catalog-drafts/${draftId}/${index}-${randomUUID()}.webp`, webp, "image/webp");
  return url;
}

/** One attempt per shot: the provider's image if it keeps the label, otherwise the plain photo */
export async function processShot(draftId: string, index: number, photo: Buffer): Promise<{ shot: ProcessedShot; usage: UsageEntry[] }> {
  if (imageProvider() === "photoroom") {
    const { image, usage } = await photoroomPackshot(photo);
    const shot: ProcessedShot = { index, url: await upload(draftId, index, image), source: "photoroom", verdict: null, differences: [] };
    return { shot, usage };
  }
  const render = await renderOpenAI(photo);
  const check = await verifyRender(photo, render.image);
  const usable = check.result.verdict !== "fail";
  const shot: ProcessedShot = {
    index,
    url: await upload(draftId, index, usable ? render.image : await plainCleanup(photo)),
    source: usable ? "openai" : "plain",
    verdict: check.result.verdict,
    differences: check.result.differences.map((d) => `${d.severity}: "${d.original}" → "${d.retouched}"`),
  };
  return { shot, usage: [render.usage, check.usage] };
}
