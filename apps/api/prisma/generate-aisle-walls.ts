/**
 * Paints the photo behind Walk the store's hanging signs for each department: a close view of a local Tamil Nadu shop's
 * section for that department's goods, in the fitting they'd really sit in (fridges for dairy, crates for vegetables).
 * Uploads to the media CDN and saves the URL on the department. Departments that already have one are skipped unless
 * --force is passed.
 * Run: npx tsx prisma/generate-aisle-walls.ts [--force]   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import OpenAI from "openai";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
// The shell exports another OpenAI key with no credits; the project's .env must win
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const { putObject } = await import("../src/services/media.js");

const prisma = new PrismaClient();
const MODEL = "gpt-image-2.5-flare";
const PARALLEL = 4;
// The band behind the signs: the lights and the upper shelves, at three times the phone's width
const CROP = { left: 0, top: 80, width: 1536, height: 700 };
const OUT = { width: 1170, height: 533 };

// The fitting each department's goods really sit in, so every department's photo looks like its own corner of the shop
const FITTINGS: Record<string, string> = {
  "fruits-vegetables": "wooden crates and tilted produce baskets heaped with fresh vegetables and fruit",
  dairy: "a row of glass-door dairy fridges lit from inside, full of milk packets, curd cups, paneer, butter and cheese",
  "grocery-staples": "wooden shelves stacked with rice sacks, atta and flour packs, dal pouches, oil bottles and spice boxes",
  "meat-fish-eggs": "a chilled glass counter with fish laid on ice, chicken and mutton cuts, and trays of eggs beside it",
  "snacks-packaged-foods": "white metal shelves lined with colourful packets of chips, namkeen, biscuits and instant noodles",
  beverages: "glass-door drink coolers and shelves of soft drink bottles, juice cartons, tea and coffee packs",
  bakery: "a glass bakery counter with fresh bread loaves, buns, rusks, cakes and pastries on racks behind it",
  "home-care": "white metal shelves of detergent packs and bottles, dishwash bars and liquids, floor cleaners and brooms",
  "personal-care": "neat shelves of soaps, shampoo and lotion bottles, toothpaste, and skin care products",
  "pooja-festivals": "shelves of brass diyas and lamps, agarbatti and camphor packs, kumkum, sandalwood and marigold garlands",
  "baby-care": "shelves of baby diaper packs, baby food tins, wipes, and gentle baby soaps and lotions",
  "frozen-foods": "open chest freezers and glass-door freezers with frozen snack packs, ice cream tubs and frozen peas",
  "paan-corner": "a small paan counter with jars of mukhwas and mouth fresheners, and fresh betel leaves",
  "gourmet-world-foods": "shelves of imported pasta, olive oil bottles, sauces, cereals and organic health foods",
  "pet-care": "shelves of dog and cat food bags and tins, pet treats and simple pet accessories",
  "stationery-general-merchandise": "shelves and pegboards with notebooks, pens, batteries, bulbs and kitchen tools",
};

function prompt(slug: string, department: string, aisles: string[]) {
  const fitting = FITTINGS[slug] ?? `shelves stocked neatly with ${aisles.join(", ")}`;
  return [
    `Photograph inside a bright, clean neighbourhood supermarket in a small town in Tamil Nadu, India: the ${department} section.`,
    `A close, eye-level view across the aisle at ${fitting}, filling the frame edge to edge, with only a little of the aisle`,
    "continuing at one side. Only this section's goods are in view. Warm, even shop lighting, gentle depth of field. Calm,",
    "airy mood with a soft mint colour grade. Wide landscape. No people, no text, no letters, no logos, no signs, no price labels.",
  ].join(" ");
}

async function paint(department: { id: string; name: string; slug: string; categories: { name: string }[] }) {
  const openai = new OpenAI();
  const res = await openai.images.generate({
    model: MODEL, prompt: prompt(department.slug, department.name, department.categories.map((c) => c.name)), n: 1, size: "1536x1024", quality: "medium",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${department.name}: no image returned`);
  const image = await sharp(Buffer.from(b64, "base64")).extract(CROP).resize(OUT.width, OUT.height).webp({ quality: 72 }).toBuffer();
  const { url } = await putObject(`aisle-walls/${department.slug}-${randomUUID().slice(0, 8)}.webp`, image, "image/webp");
  await prisma.department.update({ where: { id: department.id }, data: { aisleImageUrl: url } });
  console.log(`${department.name}: ${url} (${Math.round(image.length / 1024)} KB)`);
}

async function main() {
  const force = process.argv.includes("--force");
  const departments = await prisma.department.findMany({
    where: force ? {} : { aisleImageUrl: null },
    select: { id: true, name: true, slug: true, categories: { select: { name: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  for (let i = 0; i < departments.length; i += PARALLEL) {
    const results = await Promise.allSettled(departments.slice(i, i + PARALLEL).map(paint));
    for (const r of results) if (r.status === "rejected") console.error(r.reason instanceof Error ? r.reason.message : r.reason);
  }
}

main().finally(() => prisma.$disconnect());
