/**
 * Sree Ranga Store's own toor dal pack (redrawn in scripts/store-pack/sreeranga) as its default pack design, and blank
 * pouch photos on the loose staples it is printed onto (prisma/data/store-pack-staples.json; photos from
 * scripts/store-pack/gen-staples.mjs). Idempotent: re-running updates in place.
 *
 *   cd apps/api && python3 ../../scripts/store-pack/sreeranga/build.py "$PWD/../../scripts/store-pack/sreeranga/out"
 *   cd apps/api && npx tsx prisma/seed-pack-designs.ts           # local DB
 *   cd apps/api && npx tsx prisma/seed-pack-designs.ts --prod    # PROD_DATABASE_URL
 */
import "../src/load-env.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";
import { putObject } from "../src/services/media.js";
import type { PackZone } from "../src/services/pack-render/index.js";

const prisma = new PrismaClient({
  datasourceUrl: process.argv.includes("--prod") ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL,
});
const PACK_DIR = new URL("../../../scripts/store-pack/", import.meta.url);
const STORE_SLUG = "sreerangastore";

// Standard values per 100 g (Indian Food Composition Tables, NIN 2017; USDA FoodData Central where IFCT has none)
type Per100g = [kcal: number, protein: number, carbohydrate: number, fibre: number, fat: number];
const nutritionLabel = ([kcal, protein, carbohydrate, fibre, fat]: Per100g) => ({
  "Nutrition per": "100 g", "Energy value": `${kcal} Kcal`, "Protein": `${protein} g`,
  "Carbohydrate": `${carbohydrate} g`, "Dietary fibre": `${fibre} g`, "Total fat": `${fat} g`,
});

interface Staple { name: string; photo?: string; ingredients: string; per100g: Per100g | null }
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Each photo is an edit of the toor dal one, so the pouch keeps the template's exact shape
const STAPLES: Staple[] = JSON.parse(readFileSync(new URL("./data/store-pack-staples.json", import.meta.url), "utf8"));
const photoOf = (s: Staple) => s.photo ?? `ai/staples/pillow-${slugOf(s.name)}.png`;

// Artwork pixels (1252 × 1528): build.py layout coordinates shifted by its bleed; matches the sample text it places
const PAD = 126;
const INK = "#1f2937";
const ZONES: PackZone[] = [
  { side: "front", field: "nameTa", x: 500 + PAD, cy: 82, maxW: 420, maxH: 84, size: 52, color: "#c8102e", font: "ta-bold", align: "middle" },
  { side: "front", field: "netWeight", x: 100 + PAD, cy: 573, maxW: 112, size: 34, color: INK, font: "en-bold", align: "middle" },
  { side: "back", field: "netWeight", x: 770 + PAD, cy: 113, maxW: 170, size: 26, color: INK, font: "en-semibold", align: "start" },
  { side: "back", field: "nameEn", x: 260 + PAD, cy: 1375, maxW: 220, size: 26, color: "#ffffff", font: "en-bold", align: "middle" },
  { side: "back", field: "ingredients", x: 752 + PAD, cy: 1183, maxW: 185, size: 26, color: INK, font: "en-italic", align: "start" },
  { side: "back", field: "nutrition", x: 575 + PAD, cy: 1320, maxW: 355, size: 22, color: INK, font: "en", align: "start", rowHeight: 34, valueX: 805 + PAD, rows: 5 },
];

async function upload(path: string, folder: string) {
  const body = readFileSync(new URL(path, PACK_DIR));
  const hash = createHash("sha1").update(body).digest("hex").slice(0, 10);
  const name = path.split("/").pop()!.replace(/\.png$/, "");
  return (await putObject(`${folder}/${name}-${hash}.png`, body, "image/png")).url;
}

const store = await prisma.store.findFirstOrThrow({ where: { slug: STORE_SLUG }, select: { id: true, organizationId: true } });
const design = {
  name: "Toor dal pack (green)",
  template: "pillow-1kg-full",
  frontArtUrl: await upload("sreeranga/out/front-artwork.png", `pack-designs/${STORE_SLUG}`),
  backArtUrl: await upload("sreeranga/out/back-artwork.png", `pack-designs/${STORE_SLUG}`),
  zones: ZONES as object[],
  isDefault: true,
};

const existing = await prisma.packDesign.findFirst({ where: { storeId: store.id, name: design.name } });
if (existing) await prisma.packDesign.update({ where: { id: existing.id }, data: design });
else await prisma.packDesign.create({ data: { ...design, storeId: store.id, organizationId: store.organizationId } });

const missing = STAPLES.filter((s) => !existsSync(new URL(photoOf(s), PACK_DIR)));
for (const staple of STAPLES.filter((s) => !missing.includes(s))) {
  const product = await prisma.product.findFirstOrThrow({ where: { name: staple.name, brandId: null, organizationId: null } });
  await prisma.product.update({
    where: { id: product.id },
    data: {
      packPhotoUrl: await upload(photoOf(staple), "pack-photos"),
      ingredients: product.ingredients ?? staple.ingredients,
      ...(product.nutritionalInfo === null && staple.per100g && { nutritionalInfo: nutritionLabel(staple.per100g) }),
    },
  });
}
console.log(`Pack design ${existing ? "updated" : "created"} for ${STORE_SLUG}; pouch photos on ${STAPLES.length - missing.length} staples`);
if (missing.length) console.log(`No photo yet: ${missing.map((s) => s.name).join(", ")}`);
await prisma.$disconnect();
