/**
 * Paints a store's cover banners (HERO_CAROUSEL, English + Tamil) and adds them to the store. They show under the store
 * header on martlyshop.in, on the app's Home and on the store's card in the app's store selector.
 *
 * Usage: cd apps/api
 *   npx tsx scripts/store-cover-banners.ts paint <covers.json> [--prod]   paint the set into <covers>.painted.json
 *   npx tsx scripts/store-cover-banners.ts insert <covers.json> [--prod]  add the painted banners to the store
 * Paint first and look at every image before inserting. Platform-made, so no AI image credits are taken.
 *
 * covers.json: { "townSlug", "storeSlug", "covers": [{ "key", "scene", "en": { "title", "subtitle" }, "ta": {…},
 *   "action": { "type": "CATEGORY" | "COLLECTION" | "NONE", "target": "<category name or collection title>" }, "endsAt"? }] }
 * Targets are names, looked up in the database the banners go into.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { existsSync, readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "../generated/prisma/index.js";
import { buildDesignedBannerSet } from "../src/services/seasonal/banner-set.js";

type Copy = { title: string; subtitle: string };
interface Cover {
  key: string;
  scene: string;
  en: Copy;
  ta: Copy;
  action: { type: "CATEGORY" | "COLLECTION" | "NONE"; target?: string };
  endsAt?: string | null;
}
interface Manifest { townSlug: string; storeSlug: string; covers: Cover[] }
type Painted = Cover & { imageUrl: string; imageUrls: Record<string, string> | null; textInImage: boolean };

const [mode, manifestPath] = process.argv.slice(2);
if (!manifestPath || (mode !== "paint" && mode !== "insert")) throw new Error("Usage: store-cover-banners.ts paint|insert <covers.json> [--prod]");
const prod = process.argv.includes("--prod");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
const paintedPath = manifestPath.replace(/\.json$/, "") + ".painted.json";

const findStore = () => prisma.store.findFirstOrThrow({
  where: { slug: manifest.storeSlug, town: { slug: manifest.townSlug } },
  select: { id: true, organizationId: true },
});

/** Painted covers are kept, so a re-run only paints the ones still missing */
async function paint() {
  const store = await findStore();
  const painted: Painted[] = existsSync(paintedPath) ? JSON.parse(readFileSync(paintedPath, "utf8")) : [];
  for (const cover of manifest.covers.filter((c) => !painted.some((p) => p.key === c.key))) {
    const art = await buildDesignedBannerSet(
      prisma, { organizationId: store.organizationId, purpose: "BANNER" }, cover.scene,
      { en: cover.en, ta: cover.ta }, `${manifest.storeSlug}-${cover.key}`, (m) => console.log(`  ${cover.key}: ${m}`),
    );
    painted.push({ ...cover, ...art });
    console.log(`${cover.key}: ${art.imageUrl}${art.imageUrls?.ta ? `\n  ta: ${art.imageUrls.ta}` : "\n  (no Tamil)"}`);
    writeFileSync(paintedPath, JSON.stringify(painted, null, 2));
  }
}

async function actionTarget(organizationId: string, { type, target }: Cover["action"]) {
  if (type === "NONE") return null;
  const row = type === "CATEGORY"
    ? await prisma.category.findFirst({ where: { name: target }, select: { id: true } })
    : await prisma.collection.findFirst({ where: { organizationId, title: target }, select: { id: true } });
  if (!row) throw new Error(`No ${type.toLowerCase()} named "${target}"`);
  return row.id;
}

/** Skips covers whose image the store already shows, so a re-run adds only the new ones */
async function insert() {
  const store = await findStore();
  const painted = JSON.parse(readFileSync(paintedPath, "utf8")) as Painted[];
  const have = new Set((await prisma.banner.findMany({ where: { storeId: store.id }, select: { imageUrl: true } })).map((b) => b.imageUrl));
  const fresh = painted.filter((p) => !have.has(p.imageUrl));
  const targets = await Promise.all(fresh.map((p) => actionTarget(store.organizationId, p.action)));
  const rows = await prisma.$transaction(fresh.map((p, i) => prisma.banner.create({
    data: {
      title: p.en.title, subtitle: p.en.subtitle, imageUrl: p.imageUrl, imageUrls: p.imageUrls ?? undefined, textInImage: p.textInImage,
      placement: "HERO_CAROUSEL", actionType: p.action.type, actionTarget: targets[i], sortOrder: painted.indexOf(p),
      endsAt: p.endsAt ? new Date(p.endsAt) : null, storeId: store.id, organizationId: store.organizationId, sponsorType: "STORE",
    },
    select: { id: true },
  })));
  console.log(`${prod ? "PROD" : "local"}: added ${rows.length} banners (${painted.length - fresh.length} already there)`);
}

await (mode === "paint" ? paint() : insert()).finally(() => prisma.$disconnect());
