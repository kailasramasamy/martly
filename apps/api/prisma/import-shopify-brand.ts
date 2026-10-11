/**
 * Import a brand's catalog from its Shopify store (public products.json feed) into the master catalog.
 * Config: prisma/data/brand-imports/<name>.json — brand, store URL, name prefix, exclusions,
 * aliases (existing product name → site title) and ordered title rules mapping products to subcategories.
 *
 * Every run writes prisma/data/brand-imports/<name>-review.csv: each site product, what will happen to it,
 * its pack sizes with MRP (the store's compare-at price) and online price, and anything that needs a human look.
 * With --apply it also sets the brand logo and theme colour (config "logo"/"themeColor", if given), creates/updates products and variants (MRP set; "pack of N" bundles split into single packs;
 * unreferenced pack sizes the site doesn't sell are removed) and uploads up to 3 images per product to S3.
 *
 * Run: cd apps/api && npx tsx prisma/import-shopify-brand.ts aachi [--apply] [--refresh-images]
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient, FoodType } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { PRODUCT_TYPE, resolveSubcategory, slugify, type TaxonomyPath } from "./lib/catalog.js";
import { uploadImage, transparentLogoPng } from "./lib/media.js";
import {
  fetchShopifyProducts, toPackVariant, titlePackOf, cleanTitle, plainDescription,
  type ShopifyProduct, type PackVariant,
} from "./lib/shopify.js";

dotenv.config();

interface Config {
  brand: string; manufacturer: string; store: string; logo?: string; themeColor?: string; namePrefix: string; foodType: FoodType;
  exclude: string[]; aliases: Record<string, string>; rules: { match: string; path: TaxonomyPath }[];
}
interface Plan {
  site: ShopifyProduct; title: string; name: string; path: TaxonomyPath | null;
  variants: PackVariant[]; flags: string[]; skip?: string;
}

const prisma = new PrismaClient();
const CONFIG_NAME = process.argv[2];
const APPLY = process.argv.includes("--apply");
const REFRESH_IMAGES = process.argv.includes("--refresh-images");
const DATA_DIR = new URL("./data/brand-imports/", import.meta.url);
const MAX_IMAGES = 3;

// Larger pack priced below a smaller one (per unit family) usually means a pouch vs jar, or a data error
function priceAnomalies(variants: PackVariant[]): string[] {
  const grams = (v: PackVariant) => v.unitValue * (v.unitType === "KG" || v.unitType === "LITER" ? 1000 : 1);
  const sorted = [...variants].sort((a, b) => grams(a) - grams(b));
  return sorted.flatMap((v, i) => sorted.slice(0, i)
    .filter((smaller) => grams(smaller) < grams(v) && smaller.mrp > v.mrp)
    .map((smaller) => `${v.name} MRP ₹${v.mrp} < ${smaller.name} MRP ₹${smaller.mrp}`));
}

function planProduct(site: ShopifyProduct, config: Config): Plan {
  const title = cleanTitle(site.title);
  const name = `${config.namePrefix}${title}`;
  const base = { site, title, name, path: null, variants: [], flags: [] };
  if (config.exclude.some((x) => site.title.includes(x))) return { ...base, skip: "excluded" };

  const rule = config.rules.find((r) => new RegExp(r.match, "i").test(title));
  const packOf = titlePackOf(site.title);
  const parsed = site.variants.map((v) => ({ v, pack: toPackVariant(v, packOf) }));
  const flags = parsed.filter((p) => !p.pack).map((p) => `unparsed size "${p.v.title}"`);
  const byName = new Map<string, PackVariant>();
  for (const { pack } of parsed) if (pack && (!byName.has(pack.name) || !pack.note)) byName.set(pack.name, pack);
  const variants = [...byName.values()];

  flags.push(...variants.filter((v) => v.note).map((v) => `${v.name}: ${v.note}`));
  flags.push(...variants.filter((v) => !v.available).map((v) => `${v.name}: out of stock online`));
  flags.push(...priceAnomalies(variants));
  if (!rule) flags.push("no category rule matched");
  const skip = !rule ? "unmapped" : variants.length === 0 ? "no usable sizes" : undefined;
  return { ...base, path: rule?.path ?? null, variants, flags, skip };
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeReview(plans: Plan[], existingNames: Set<string>): string {
  const header = "site_title,product_name,action,category,pack_sizes_mrp,online_prices,images,flags";
  const lines = plans.map((p) => [
    p.site.title, p.name, p.skip ? `skip (${p.skip})` : existingNames.has(p.name) ? "update" : "create",
    p.path?.join(" > ") ?? "", p.variants.map((v) => `${v.name} ₹${v.mrp}`).join(" | "),
    p.variants.map((v) => `${v.name} ₹${v.onlinePrice}`).join(" | "), String(Math.min(p.site.images.length, MAX_IMAGES)),
    p.flags.join("; "),
  ].map(csvCell).join(","));
  const file = new URL(`${CONFIG_NAME}-review.csv`, DATA_DIR);
  writeFileSync(file, [header, ...lines].join("\n") + "\n");
  return file.pathname;
}

async function toWebp(url: string, size: number): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${url}: HTTP ${res.status}`);
  return sharp(Buffer.from(await res.arrayBuffer()))
    .resize(size, size, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" })
    .webp({ quality: 85 }).toBuffer();
}

async function applyBrandLogo(brand: { id: string; imageUrl: string | null }, logo: string, brandSlug: string) {
  if (brand.imageUrl && !REFRESH_IMAGES) return;
  const res = await fetch(logo);
  if (!res.ok) throw new Error(`logo ${logo}: HTTP ${res.status}`);
  const png = await transparentLogoPng(Buffer.from(await res.arrayBuffer()));
  const imageUrl = await uploadImage(`brands/${brandSlug}/logo`, png, "png");
  await prisma.brand.update({ where: { id: brand.id }, data: { imageUrl } });
  console.log(`  logo: ${imageUrl}`);
}

async function uploadProductImages(site: ShopifyProduct, brandSlug: string, slug: string): Promise<string[]> {
  const urls: string[] = [];
  for (const [i, img] of site.images.slice(0, MAX_IMAGES).entries()) {
    const webp = await toWebp(`${img.src}${img.src.includes("?") ? "&" : "?"}width=1000`, 800);
    urls.push(await uploadImage(`catalog/brands/${brandSlug}/${slug}-${i + 1}`, webp));
  }
  return urls;
}

// Adds/updates the site's pack sizes (with MRP) and removes old sizes nothing references
async function syncVariants(productId: string, variants: PackVariant[]): Promise<string[]> {
  const existing = await prisma.productVariant.findMany({
    where: { productId },
    select: { id: true, name: true, _count: { select: { storeProducts: true, orderItems: true } } },
  });
  for (const v of variants) {
    const data = { unitType: v.unitType, unitValue: v.unitValue, mrp: v.mrp };
    const match = existing.find((e) => e.name === v.name);
    if (match) await prisma.productVariant.update({ where: { id: match.id }, data });
    else await prisma.productVariant.create({ data: { ...data, name: v.name, productId } });
  }
  const stale = existing.filter((e) => !variants.some((v) => v.name === e.name));
  const removable = stale.filter((e) => e._count.storeProducts === 0 && e._count.orderItems === 0);
  if (removable.length) await prisma.productVariant.deleteMany({ where: { id: { in: removable.map((e) => e.id) } } });
  return stale.filter((e) => !removable.includes(e)).map((e) => e.name);
}

async function applyPlan(plan: Plan, config: Config, brandId: string): Promise<"created" | "updated"> {
  const oldNames = Object.entries(config.aliases).filter(([, t]) => t === plan.title).map(([old]) => old);
  const existing = await prisma.product.findFirst({
    where: { brandId, organizationId: null, name: { in: [plan.name, ...oldNames] } },
  });
  const sub = await resolveSubcategory(prisma, plan.path!);
  const data = {
    name: plan.name, subcategoryId: sub.id, manufacturerName: config.manufacturer,
    productType: PRODUCT_TYPE[plan.path![0]], foodType: config.foodType,
    description: plainDescription(plan.site.body_html),
  };
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data: { ...data, brandId } });

  const kept = await syncVariants(product.id, plan.variants);
  if (kept.length) console.warn(`  ${plan.name}: kept sizes still referenced by stores/orders: ${kept.join(", ")}`);
  if (REFRESH_IMAGES || product.images.length === 0) {
    const urls = await uploadProductImages(plan.site, slugify(config.brand), slugify(plan.name));
    if (urls.length) await prisma.product.update({ where: { id: product.id }, data: { imageUrl: urls[0], images: urls } });
  }
  return existing ? "updated" : "created";
}

async function main() {
  if (!CONFIG_NAME) throw new Error("Usage: import-shopify-brand.ts <config-name> [--apply] [--refresh-images]");
  const config: Config = JSON.parse(readFileSync(new URL(`${CONFIG_NAME}.json`, DATA_DIR), "utf8"));
  console.log(`${APPLY ? "Importing" : "Dry run"}: ${config.brand} from ${config.store} into ${new URL(process.env.DATABASE_URL!).host}`);

  const plans = (await fetchShopifyProducts(config.store)).map((p) => planProduct(p, config));
  const brand = await prisma.brand.findFirst({ where: { OR: [{ name: config.brand }, { slug: slugify(config.brand) }] } });
  const existing = brand
    ? await prisma.product.findMany({ where: { brandId: brand.id, organizationId: null }, select: { name: true } })
    : [];
  const aliasTargets = Object.entries(config.aliases).filter(([old]) => existing.some((e) => e.name === old));
  const existingNames = new Set([...existing.map((e) => e.name), ...aliasTargets.map(([, t]) => `${config.namePrefix}${t}`)]);
  const todo = plans.filter((p) => !p.skip);
  console.log(`${plans.length} site products → ${todo.length} to import, ${plans.length - todo.length} skipped; ` +
    `${todo.filter((p) => existingNames.has(p.name)).length} already in catalog; ${todo.filter((p) => p.flags.length).length} flagged`);
  console.log(`Review: ${writeReview(plans, existingNames)}`);
  if (!APPLY) return;

  const target = brand ?? await prisma.brand.create({ data: { name: config.brand, slug: slugify(config.brand) } });
  const brandId = target.id;
  if (config.logo) await applyBrandLogo(target, config.logo, slugify(config.brand));
  if (config.themeColor) await prisma.brand.update({ where: { id: brandId }, data: { themeColor: config.themeColor } });
  const counts = { created: 0, updated: 0 };
  for (const plan of todo) counts[await applyPlan(plan, config, brandId)]++;
  console.log(`✔ ${counts.created} products created, ${counts.updated} updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
