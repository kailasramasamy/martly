/**
 * Last step of the shelf-photo import: puts the products approved on the review page into the master catalog and lists
 * them at PSB and Sree Ranga, priced as approved, with the --stock count (0 unless given). Images come from run/final (MRP, batch and dates hidden).
 * Safe to re-run: a product whose SKU already exists only gets any missing store listing. Writes run/fix-list.json for
 * the second pass. Uses DATABASE_URL unless --prod is passed. Images always go to the live bucket.
 *
 *   npx tsx scripts/shelf-photos/publish.ts --run ~/Downloads/psb-products-2026-11-02/run [--dry-run] [--prod] [--stock 30] [--decisions file] [--no-claude]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import * as z from "zod/v4";
import { PrismaClient, type Prisma } from "../../generated/prisma/client.js";

dotenv.config({ override: true });
const { putObject } = await import("../../src/services/media.js");
const { uniqueBrandSlug } = await import("../../src/services/brands.js");
const { MODEL } = await import("../../src/services/catalog-agent/extract.js");

/** Sree Ranga only: PSB (942432de-5c51-437a-b747-67a874809bd8) lists by hand on aisle walks since 2026-11-26 */
const STORES = ["8f56d5c1-7a4d-4e87-8fe1-2d0b8600c839"];

type Tx = Prisma.TransactionClient;
interface Shot { file: string; image: string | null; verdict: string | null; differences: string[]; fixedComment?: string }
interface Label {
  name: string; brand: string | null; variantName: string; unitType: Prisma.ProductVariantCreateInput["unitType"]; unitValue: number; barcode: string | null;
  foodType: Prisma.ProductCreateInput["foodType"]; productType: Prisma.ProductCreateInput["productType"]; description: string | null; ingredients: string | null;
  nutrition: { name: string; value: string }[]; allergens: string[]; tags: string[]; fssaiLicense: string | null; manufacturerName: string | null;
  countryOfOrigin: string | null; shelfLifeDays: number | null; storageType: Prisma.ProductCreateInput["storageType"]; storageInstructions: string | null;
  usageInstructions: string | null; dangerWarnings: string | null;
}
interface Tamil { name: string; description: string | null; ingredients: string | null; storageInstructions: string | null; usageInstructions: string | null; nutrientNames: string[] }
interface Product {
  id: string; photos: string[]; main: string; label: Label; tamil: Tamil; shots: Shot[];
  classification: { brand: { id: string } | null; subcategoryId: string | null } | null;
}
interface Decision { status: string; mrp: number; sellingPrice: number; name?: string; variantName?: string; ingredients?: string; nutrition?: Label["nutrition"] }
interface Hidden { blocks: number; busyBackground: number }

const argv = process.argv.slice(2);
const value = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const runDir = value("--run");
if (!runDir) throw new Error("--run is required");
const dryRun = argv.includes("--dry-run");
const stock = Number(value("--stock") ?? 0);
// No Anthropic calls: Tamil for reviewer edits comes from run/tamil-edits.json, written in a Claude Code session from run/tamil-edits-todo.json
const noClaude = argv.includes("--no-claude");
const tamilTodo: Record<string, unknown> = {};
const readJson = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const prisma = new PrismaClient(argv.includes("--prod") ? { datasourceUrl: process.env.PROD_DATABASE_URL } : {});

// Photo numbers repeat across phones: give a batch whose IMG range overlaps an earlier one its own --sku-prefix (e.g. SP-K27-)
const skuPrefix = value("--sku-prefix") ?? "SP-";
const skuOf = (product: Product) => `${skuPrefix}${product.id.replace(/^IMG_/, "")}`;
const stem = (file: string) => file.replace(/\.[^.]+$/, "");

/** The main photo first, then the rest in the order they were taken; photos with no usable render are left out */
function imagesOf(product: Product) {
  const shots = product.shots.filter((s) => s.image);
  return [...shots.filter((s) => s.file === product.main), ...shots.filter((s) => s.file !== product.main)].map((s) => s.image!);
}

async function upload(image: string) {
  const body = readFileSync(join(runDir!, "final", image));
  const hash = createHash("sha1").update(body).digest("hex").slice(0, 10);
  return (await putObject(`catalog/shelf-photos/${stem(image)}-${hash}.webp`, body, "image/webp")).url;
}

function translations(product: Product) {
  const { label, tamil } = product;
  const nutrition = label.nutrition.length ? Object.fromEntries(label.nutrition.map((n, i) => [tamil.nutrientNames[i] ?? n.name, n.value])) : null;
  return {
    ta: {
      name: tamil.name,
      description: tamil.description, ingredients: tamil.ingredients, storageInstructions: tamil.storageInstructions, usageInstructions: tamil.usageInstructions,
      ...(nutrition ? { nutritionalInfo: nutrition } : {}),
    },
  };
}

/** Finds the master brand by id or name, or creates it, so packs of a new brand all share one */
async function brandId(tx: Tx, product: Product) {
  const known = product.classification?.brand?.id;
  if (known && await tx.brand.findUnique({ where: { id: known }, select: { id: true } })) return known;
  const name = product.label.brand?.trim();
  if (!name) return null;
  const found = await tx.brand.findFirst({ where: { organizationId: null, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return found?.id ?? (await tx.brand.create({ data: { name, slug: await uniqueBrandSlug(tx, name) } })).id;
}

async function createProduct(tx: Tx, product: Product, decision: Decision, urls: string[], barcode: string | null) {
  const { label } = product;
  const name = decision.name?.trim() || label.name;
  const created = await tx.product.create({
    data: {
      name, description: label.description, imageUrl: urls[0], images: urls, cutoutUrl: urls[0],
      subcategoryId: product.classification!.subcategoryId, brandId: await brandId(tx, product), tags: label.tags, foodType: label.foodType, productType: label.productType,
      fssaiLicense: label.fssaiLicense, ingredients: label.ingredients, allergens: label.allergens, shelfLifeDays: label.shelfLifeDays, storageType: label.storageType,
      storageInstructions: label.storageInstructions, usageInstructions: label.usageInstructions, dangerWarnings: label.dangerWarnings,
      manufacturerName: label.manufacturerName, countryOfOrigin: label.countryOfOrigin, translations: translations(product),
      ...(label.nutrition.length ? { nutritionalInfo: Object.fromEntries(label.nutrition.map((n) => [n.name, n.value])) } : {}),
      variants: { create: { name: decision.variantName?.trim() || label.variantName, unitType: label.unitType, unitValue: label.unitValue, mrp: decision.mrp, sku: skuOf(product), barcode, imageUrl: urls[0] } },
    },
    select: { id: true, variants: { select: { id: true } } },
  });
  return { productId: created.id, variantId: created.variants[0].id };
}

async function listAtStores(tx: Tx, target: { productId: string; variantId: string }, price: number) {
  const made = await tx.storeProduct.createMany({ data: STORES.map((storeId) => ({ storeId, ...target, price, stock })), skipDuplicates: true });
  return made.count;
}

const EditsInTamil = z.object({ name: z.string().nullable(), ingredients: z.string().nullable(), nutrientNames: z.array(z.string()) });
const TAMIL_SYSTEM = `Translate grocery label details into natural everyday Tamil for a shopping app in Dharmapuri, Tamil Nadu. Keep numbers and
units as written. Keep the ingredients in the same order and don't add or drop any. Use null if there are no ingredients. Give nutrientNames in the order given. Write the product name in Tamil script as shoppers say it,
with the brand spelt out rather than translated; use null if no name is given.`;

/** The reviewer's name, ingredients and nutrition, in English, if they changed anything */
function editsOf(product: Product, decision: Decision) {
  const newName = decision.name?.trim() && decision.name.trim() !== product.label.name ? decision.name.trim() : null;
  if (!newName && decision.ingredients === undefined && decision.nutrition === undefined) return null;
  const label = { ...product.label, ingredients: decision.ingredients === undefined ? product.label.ingredients : decision.ingredients.replace(/^\s*ingredients?\s*[:-]\s*/i, "") || null, nutrition: decision.nutrition ?? product.label.nutrition };
  return { newName, label, english: { name: newName, ingredients: label.ingredients, nutrients: label.nutrition.map((n) => n.name) } };
}

function sessionTamil(id: string) {
  const path = join(runDir!, "tamil-edits.json");
  const edits = existsSync(path) ? readJson<Record<string, unknown>>(path) : {};
  return edits[id] === undefined ? null : EditsInTamil.parse(edits[id]);
}

/** The reviewer's edits replace what was read, and are translated again */
async function withEdits(product: Product, decision: Decision): Promise<Product> {
  const edits = editsOf(product, decision);
  if (!edits) return product;
  const { newName, label } = edits;
  if (noClaude) {
    const tamil = sessionTamil(product.id)!;
    return { ...product, label, tamil: { ...product.tamil, ...tamil, name: tamil.name ?? product.tamil.name } };
  }
  const response = await new Anthropic().beta.messages.create({
    model: MODEL, max_tokens: 8000, system: TAMIL_SYSTEM, output_config: { format: betaZodOutputFormat(EditsInTamil) },
    messages: [{ role: "user", content: JSON.stringify({ name: newName, ingredients: label.ingredients, nutrients: label.nutrition.map((n) => n.name) }) }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`${product.id}: translation stopped with ${response.stop_reason}`);
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  const tamil = EditsInTamil.parse(JSON.parse(text));
  return { ...product, label, tamil: { ...product.tamil, ...tamil, name: tamil.name ?? product.tamil.name } };
}

/** Already published, or the barcode shows the master catalog has it: only listings are needed */
async function findExisting(product: Product) {
  const bySku = await prisma.productVariant.findUnique({ where: { sku: skuOf(product) }, select: { id: true, productId: true } });
  if (bySku) return { target: { productId: bySku.productId, variantId: bySku.id }, barcode: null, by: "sku" };
  const barcode = product.label.barcode;
  const match = barcode ? await prisma.productVariant.findUnique({ where: { barcode }, select: { id: true, productId: true, product: { select: { organizationId: true } } } }) : null;
  if (!match) return { target: null, barcode, by: null };
  return match.product.organizationId === null ? { target: { productId: match.productId, variantId: match.id }, barcode: null, by: "barcode" } : { target: null, barcode: null, by: null };
}

/** Every catalog image must be a cut-out: an alpha channel, and the padded canvas corners see-through */
async function isTransparent(image: string) {
  const { data, info } = await sharp(join(runDir!, "final", image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
  const [right, bottom] = [info.width - 1, info.height - 1];
  return [alphaAt(0, 0), alphaAt(right, 0), alphaAt(0, bottom), alphaAt(right, bottom)].every((a) => a === 0);
}

async function publishOne(product: Product, decision: Decision) {
  const { target, barcode, by } = await findExisting(product);
  if (target) return dryRun ? `would list (${by} match)` : `listed at ${await prisma.$transaction((tx) => listAtStores(tx, target, decision.sellingPrice))} more stores`;
  const images = imagesOf(product);
  if (!images.length) return "held: no image";
  const opaque = (await Promise.all(images.map(isTransparent))).filter((ok) => !ok).length;
  if (opaque) return `held: ${opaque} image(s) not transparent`;
  if (!product.classification?.subcategoryId) return "held: no category";
  const edits = noClaude ? editsOf(product, decision) : null;
  if (edits && !sessionTamil(product.id)) {
    tamilTodo[product.id] = edits.english;
    return "held: Tamil for edits not in tamil-edits.json";
  }
  if (dryRun) return "would create";
  const edited = await withEdits(product, decision);
  const urls = await Promise.all(images.map(upload));
  await prisma.$transaction(async (tx) => listAtStores(tx, await createProduct(tx, edited, decision, urls, barcode), decision.sellingPrice));
  return "created";
}

/** What the second pass has to look at, from the approved products */
function fixList(approved: Product[]) {
  const commentsPath = join(runDir!, "comments.json");
  const comments = existsSync(commentsPath) ? readJson<Record<string, Record<string, string>>>(commentsPath) : {};
  const hidden = readJson<Record<string, Hidden>>(join(runDir!, "hidden.json"));
  return approved.flatMap((product) => product.shots.flatMap((shot) => {
    const log = shot.image ? hidden[shot.image] : undefined;
    const reasons = [
      ...(shot.image ? [] : ["no image"]),
      ...(shot.verdict === "fail" ? ["text differs"] : []),
      ...(log?.busyBackground ? ["patch on a busy background"] : []),
      ...(comments[product.id]?.[shot.file] && comments[product.id][shot.file] !== shot.fixedComment ? [`reviewer: ${comments[product.id][shot.file]}`] : []),
    ];
    return reasons.length ? [{ product: product.id, name: product.label.name, photo: shot.file, reasons, differences: shot.differences }] : [];
  }));
}

async function main() {
  const decisions = readJson<Record<string, Decision>>(value("--decisions") ?? join(runDir!, "decisions.json"));
  const dir = join(runDir!, "products");
  const approved = readdirSync(dir).map((f) => readJson<Product>(join(dir, f))).filter((p) => decisions[p.id]?.status === "approved");
  const tally: Record<string, number> = {};
  for (const product of approved) {
    const outcome = await publishOne(product, decisions[product.id]);
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    console.log(`${product.id} ${product.label.name}: ${outcome}`);
  }
  if (existsSync(join(runDir!, "hidden.json"))) writeFileSync(join(runDir!, "fix-list.json"), JSON.stringify(fixList(approved), null, 1));
  if (Object.keys(tamilTodo).length) writeFileSync(join(runDir!, "tamil-edits-todo.json"), JSON.stringify(tamilTodo, null, 1));
  console.log(`${approved.length} approved: ${JSON.stringify(tally)}`);
}

await main().finally(() => prisma.$disconnect());
