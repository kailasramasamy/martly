/**
 * Step 2 of the shelf-photo import, all saved locally in the run folder: for each checked product group it reads the label,
 * checks the barcode and picks the brand and aisle (read-only against prod), writes the Tamil, and makes a transparent image of
 * every photo. A product that's already in the master catalog gets no images. Safe to re-run: finished work is skipped.
 *
 * --fix-comments renders only the photos with a new comment from the review page again, following the comment; the old files go
 * to run/before-fix. Run hide-stamps.py afterwards.
 *
 * --no-claude makes no Anthropic calls: the label, aisle and Tamil must already be in products/<id>.json (written in a Claude Code
 * session), renders are saved unchecked (verdict "unchecked") for the session to check, and only the barcode is looked up here.
 *
 *   npx tsx scripts/shelf-photos/process.ts --run ~/Downloads/psb-products-2026-11-02/run [--limit 3] [--max-usd 20] [--fix-comments] [--no-claude]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import * as z from "zod/v4";

dotenv.config({ override: true });
const { PrismaClient } = await import("../../generated/prisma/client.js");
const { readLabel, ExtractRefusedError, MODEL } = await import("../../src/services/catalog-agent/extract.js");
const { brandCandidates, classify, findByBarcode } = await import("../../src/services/catalog-agent/match.js");
const { imageBlock, normalise } = await import("../../src/services/catalog-agent/photos.js");
const { claudeUsage, imageUsage } = await import("../../src/services/catalog-agent/usage.js");
const { Tamil } = await import("./schemas.js");

const IMAGE_MODEL = "gpt-image-2.5-flare";
const CANVAS = 1024;
const PACK_EDGE = 860;
const GROUPS_AT_ONCE = 3;
const PHOTOS_AT_ONCE = 2;
// A render whose trimmed edge is nearly all opaque white kept a white backdrop instead of cutting the pack out
const WHITE_EDGE_SHARE = 0.9;
// Failed renders are flagged for the fix pass; in the pilot a second try never turned a failure into a pass
const MAX_ATTEMPTS = 1;
// No organisation matches this, so the brand candidates are master brands only
const MASTER_ONLY = "master-catalog";

const RENDER_PROMPT = `Turn this phone photo into a professional e-commerce catalogue packshot of the exact same product.
Keep the product itself identical: same pack shape, colours, logo, artwork and every word, number and symbol of the label,
exactly as photographed. Do not redraw, translate, correct or invent any text. Keep the fill level of the contents as photographed.
Where small text is too blurry to read, keep it soft and blurry rather than guessing new words.
Remove the background, hands, feet, stools, shelves, tags and every other object, and remove glare, reflections and wrinkles.
Place the product upright, with the side shown in the photo facing the camera, centred on a fully transparent background,
filling about 80% of the frame, with soft even studio lighting. No shadow, no floor, no backdrop.`;

const FIX_NOTE = `The pack is resting on a stool or round plate. The stool or plate, and any tag, card or graphic sticking out from under or behind
the pack, is background: remove all of it completely, so that only the pack itself remains, with its true outline.`;

const VERIFY_SYSTEM = `You check an AI-retouched product packshot against the original phone photo of the same pack, for a grocery catalogue.
Read the text on the pack in BOTH images and compare word by word, number by number. Report only real differences:
changed, added, dropped or garbled words, numbers or symbols, a different logo, pack shape, colour or fill level.
Ignore background, lighting, shadow, straightening, and text that is unreadable in the original.
Compare licence numbers, phone numbers, addresses, weights, prices and dates digit by digit.
Text in the retouched image where the original is hidden by glare or cut off is invented: report it. Report garbled Tamil or other Indian scripts.
critical = brand, product name, claims ("high in", "no added"), quantities, nutrition values, FSSAI/licence numbers, phone numbers,
addresses, veg/non-veg mark, prices, ingredients, invented text, fill level or pack shape. minor = slogans, taglines, decorative or tiny text.
verdict: pass = no differences; minor_only = only minor ones; fail = any critical one.`;

const Verify = z.object({
  differences: z.array(z.object({ original: z.string(), retouched: z.string(), severity: z.enum(["critical", "minor"]) })),
  verdict: z.enum(["pass", "minor_only", "fail"]),
});

const TAMIL_SYSTEM = `You translate grocery product details into Tamil for a shopping app used in Dharmapuri, Tamil Nadu.
Write natural everyday Tamil, the way a local shopper would say it, not a literal translation. Write brand names in Tamil script;
don't translate their meaning. Keep pack sizes, numbers and units as written. Use null wherever the English is missing.
Keep the ingredients list in the same order and don't add or drop any. Give nutrientNames in the same order as the English list.`;

interface Group { id: string; photos: string[]; main: string; skip?: boolean; checked?: boolean; confidence: string; hint?: string }
interface Shot { file: string; image: string | null; verdict: string | null; differences: string[]; attempts: number; error: string | null; fixedComment?: string }
type Label = Awaited<ReturnType<typeof readLabel>>["label"];
type Classification = Awaited<ReturnType<typeof classify>>["result"];
interface Product {
  id: string;
  photos: string[];
  main: string;
  label: Label | null;
  classification: Classification | null;
  existing: { variantId: string; productId: string; name: string } | null;
  barcodeTaken: boolean;
  tamil: z.infer<typeof Tamil> | null;
  shots: Shot[];
  usd: number;
  error: string | null;
}

class RenderError extends Error {}
class AnswerError extends Error {}
class BudgetReached extends Error {}

const argv = process.argv.slice(2);
const value = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const runDir = value("--run");
if (!runDir) throw new Error("--run is required");
const limit = Number(value("--limit")) || Infinity;
const maxUsd = Number(value("--max-usd")) || 20;
const noClaude = argv.includes("--no-claude");

const prisma = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });
const anthropic = new Anthropic();
const openai = new OpenAI();
let spent = 0;

const previewOf = (file: string) => join(runDir, "previews", file.replace(/\.(heic|jpe?g)$/i, ".jpg"));
const productPath = (id: string) => join(runDir, "products", `${id}.json`);
const isExpected = (err: unknown) => err instanceof OpenAI.APIError || err instanceof Anthropic.APIError || err instanceof ExtractRefusedError
  || err instanceof RenderError || err instanceof AnswerError || err instanceof SyntaxError;

function save(product: Product) {
  const path = productPath(product.id);
  writeFileSync(`${path}.tmp`, JSON.stringify(product, null, 1));
  renameSync(`${path}.tmp`, path);
}

function charge(product: Product, usd: number) {
  product.usd += usd;
  spent += usd;
}

function whiteEdgeShare(data: Buffer, width: number, box: { left: number; top: number; right: number; bottom: number }) {
  let [white, total] = [0, 0];
  const count = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    total++;
    if (data[i + 3] === 255 && Math.min(data[i], data[i + 1], data[i + 2]) >= 240) white++;
  };
  for (let x = box.left; x <= box.right; x++) count(x, box.top), count(x, box.bottom);
  for (let y = box.top; y <= box.bottom; y++) count(box.left, y), count(box.right, y);
  return white / total;
}

/** Fully see-through or fully solid edges, trimmed to the pack and centred, so every product sits at the same size */
async function finish(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [left, top, right, bottom, solid] = [info.width, info.height, -1, -1, 0];
  for (let i = 3, p = 0; i < data.length; i += 4, p++) {
    if (data[i] >= 250) data[i] = 255;
    else if (data[i] < 8) data[i] = 0;
    if (data[i] === 255) solid++;
    if (data[i] > 32) {
      const x = p % info.width, y = Math.floor(p / info.width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new RenderError("The image came back empty");
  if (solid / (info.width * info.height) > 0.97) throw new RenderError("The background came back solid, not transparent");
  if (whiteEdgeShare(data, info.width, { left, top, right, bottom }) > WHITE_EDGE_SHARE) throw new RenderError("A white backdrop was left behind the pack");
  const pack = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(PACK_EDGE, PACK_EDGE, { fit: "inside" }).png().toBuffer();
  const size = await sharp(pack).metadata();
  const x = Math.floor((CANVAS - size.width) / 2), y = Math.floor((CANVAS - size.height) / 2);
  return sharp(pack)
    .extend({ left: x, right: CANVAS - size.width - x, top: y, bottom: CANVAS - size.height - y, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 100 }).toBuffer();
}

async function render(product: Product, photo: Buffer, note: string) {
  const res = await openai.images.edit({
    model: IMAGE_MODEL,
    image: await toFile(await normalise(photo, 1536), "photo.jpg", { type: "image/jpeg" }),
    prompt: `${RENDER_PROMPT}\n${note}`.trim(),
    size: `${CANVAS}x${CANVAS}`,
    quality: "medium",
    background: "transparent",
    output_format: "png",
  });
  charge(product, imageUsage("render", IMAGE_MODEL, res.usage).usd);
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new RenderError(`${IMAGE_MODEL} returned no image`);
  return finish(Buffer.from(b64, "base64"));
}

async function verify(product: Product, photo: Buffer, image: Buffer) {
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: VERIFY_SYSTEM,
    output_config: { format: betaZodOutputFormat(Verify) },
    messages: [{ role: "user", content: [{ type: "text", text: "Original photo:" }, await imageBlock(photo), { type: "text", text: "Retouched packshot:" }, await imageBlock(image)] }],
  });
  charge(product, claudeUsage("verify", MODEL, response.usage).usd);
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  if (response.stop_reason !== "end_turn") throw new AnswerError(`The check stopped with ${response.stop_reason}`);
  return Verify.parse(JSON.parse(text));
}

const criticals = (result: { differences: z.infer<typeof Verify>["differences"] }) => result.differences.filter((d) => d.severity === "critical").length;

/** Keeps the attempt with the fewest critical differences, flagged for review if it still has any */
async function renderShot(product: Product, file: string, note = ""): Promise<Shot> {
  const photo = readFileSync(previewOf(file));
  const shot: Shot = { file, image: null, verdict: null, differences: [], attempts: 0, error: null };
  let best = Infinity;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && shot.verdict !== "pass" && shot.verdict !== "minor_only"; attempt++) {
    shot.attempts = attempt;
    if (spent >= maxUsd) throw new BudgetReached();
    const image = await render(product, photo, note);
    const result = noClaude ? { differences: [], verdict: "unchecked" as const } : await verify(product, photo, image);
    if (criticals(result) >= best) continue;
    best = criticals(result);
    const name = file.replace(/\.(heic|jpe?g)$/i, ".webp");
    writeFileSync(join(runDir, "rendered", name), image);
    shot.image = name;
    shot.verdict = result.verdict;
    shot.differences = result.differences.map((d) => `${d.severity}: "${d.original}" → "${d.retouched}"`);
  }
  return shot;
}

async function translate(product: Product, label: Label) {
  const english = {
    name: label.name, description: label.description, ingredients: label.ingredients,
    storageInstructions: label.storageInstructions, usageInstructions: label.usageInstructions, nutrients: label.nutrition.map((n) => n.name),
  };
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: TAMIL_SYSTEM,
    output_config: { format: betaZodOutputFormat(Tamil) },
    messages: [{ role: "user", content: JSON.stringify(english) }],
  });
  charge(product, claudeUsage("tamil", MODEL, response.usage).usd);
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  if (response.stop_reason !== "end_turn") throw new AnswerError(`The Tamil stopped with ${response.stop_reason}`);
  return Tamil.parse(JSON.parse(text));
}

async function matchBarcode(product: Product, label: Label) {
  const match = label.barcode ? await findByBarcode(prisma, label.barcode) : null;
  if (match?.product.organizationId === null) product.existing = { variantId: match.id, productId: match.productId, name: match.product.name };
  product.barcodeTaken = !!match && match.product.organizationId !== null;
}

/** Label, barcode, brand and aisle; a barcode already in the master catalog means no images are needed */
async function readDetails(product: Product, hint: string | null) {
  const { label, usage } = await readLabel(product.photos.map((file) => readFileSync(previewOf(file))), hint);
  charge(product, usage.usd);
  product.label = label;
  await matchBarcode(product, label);
  const candidates = label.brand ? await brandCandidates(prisma, label.brand, MASTER_ONLY) : [];
  const picked = await classify(prisma, label, candidates);
  charge(product, picked.usage.usd);
  product.classification = picked.result;
  save(product);
}

async function renderAll(product: Product) {
  const queue = product.photos.filter((file) => !product.shots.some((s) => s.file === file && s.image));
  await Promise.all(Array.from({ length: PHOTOS_AT_ONCE }, async () => {
    while (queue.length) {
      const file = queue.shift()!;
      let shot: Shot;
      try {
        shot = await renderShot(product, file);
      } catch (err) {
        if (!isExpected(err)) throw err;
        shot = { file, image: null, verdict: null, differences: [], attempts: MAX_ATTEMPTS, error: (err as Error).message.slice(0, 300) };
      }
      product.shots = [...product.shots.filter((s) => s.file !== file), shot];
      save(product);
    }
  }));
}

function load(group: Group): Product {
  if (existsSync(productPath(group.id))) return JSON.parse(readFileSync(productPath(group.id), "utf8")) as Product;
  return { id: group.id, photos: group.photos, main: group.main, label: null, classification: null, existing: null, barcodeTaken: false, tamil: null, shots: [], usd: 0, error: null };
}

async function processGroup(group: Group) {
  const product = load(group);
  if (noClaude && !(product.label && product.tamil)) return console.log(`${group.id} skipped: label and Tamil not written yet`);
  product.error = null;
  try {
    if (noClaude) await matchBarcode(product, product.label!);
    if (!product.label) await readDetails(product, group.hint ?? null);
    if (product.label && !product.tamil) product.tamil = await translate(product, product.label);
    save(product);
    if (!product.existing) await renderAll(product);
  } catch (err) {
    if (!isExpected(err)) throw err;
    product.error = (err as Error).message.slice(0, 300);
  }
  save(product);
  const verdicts = product.shots.map((s) => s.verdict ?? "error").join(",");
  console.log(`${product.id} ${product.label?.name ?? "(no label)"} | ${product.existing ? "already in catalog" : verdicts} | $${product.usd.toFixed(3)} | total $${spent.toFixed(2)}${product.error ? ` | ${product.error}` : ""}`);
}

/** One photo again, following the reviewer's comment. The old image stays in place until the new one is ready */
async function fixShot(product: Product, file: string, comment: string) {
  const old = product.shots.find((s) => s.file === file)?.image;
  if (old) copyFileSync(join(runDir!, "rendered", old), join(runDir!, "before-fix", `rendered-${old}`));
  const note = `${FIX_NOTE}\nThe reviewer asked: "${comment}". The product's name in Tamil is ${product.tamil?.name}; where the pack prints it, it must read exactly as on the pack.`;
  const shot = await renderShot(product, file, note);
  const name = shot.image!;
  if (existsSync(join(runDir!, "final", name))) renameSync(join(runDir!, "final", name), join(runDir!, "before-fix", `final-${name}`));
  const ocr = join(runDir!, "ocr", name.replace(/\.webp$/, ".json"));
  if (existsSync(ocr)) renameSync(ocr, join(runDir!, "before-fix", `ocr-${name.replace(/\.webp$/, ".json")}`));
  product.shots = product.shots.map((s) => (s.file === file ? { ...shot, fixedComment: comment } : s));
  save(product);
  console.log(`${product.id} ${file}: ${shot.verdict}, ${shot.differences.length} differences | total $${spent.toFixed(2)}`);
}

async function fixCommented() {
  mkdirSync(join(runDir!, "before-fix"), { recursive: true });
  const comments = JSON.parse(readFileSync(join(runDir!, "comments.json"), "utf8")) as Record<string, Record<string, string>>;
  for (const [id, byFile] of Object.entries(comments)) {
    const product = JSON.parse(readFileSync(productPath(id), "utf8")) as Product;
    if (product.existing) continue;
    for (const [file, comment] of Object.entries(byFile)) {
      if (comment && product.shots.find((s) => s.file === file)?.fixedComment !== comment) await fixShot(product, file, comment);
    }
  }
  console.log(`Done this run: $${spent.toFixed(2)}`);
}

if (argv.includes("--fix-comments")) {
  await fixCommented();
  await prisma.$disconnect();
  process.exit(0);
}

mkdirSync(join(runDir, "products"), { recursive: true });
mkdirSync(join(runDir, "rendered"), { recursive: true });
const groups = (JSON.parse(readFileSync(join(runDir, "groups.json"), "utf8")) as Group[]).filter((g) => !g.skip);
const queue = groups.slice(0, limit);
console.log(`${groups.length} products, doing ${queue.length}, stopping at $${maxUsd}`);
await Promise.all(Array.from({ length: GROUPS_AT_ONCE }, async () => {
  while (queue.length && spent < maxUsd) await processGroup(queue.shift()!);
})).catch((err: unknown) => {
  if (!(err instanceof BudgetReached)) throw err;
  console.log(`Stopped at the $${maxUsd} limit; a re-run carries on`);
});
console.log(`Done this run: $${spent.toFixed(2)}`);
await prisma.$disconnect();
