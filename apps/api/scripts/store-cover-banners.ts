/**
 * Paints a store's cover banners (HERO_CAROUSEL, English + Tamil) and adds them to the store. They show under the store
 * header on martlyshop.in, on the app's Home and on the store's card in the app's store selector.
 *
 * Usage: cd apps/api
 *   npx tsx scripts/store-cover-banners.ts paint <manifest.json>          paint the set and write the image URLs
 *   npx tsx scripts/store-cover-banners.ts insert <manifest.json> [--prod] add the banners locally, and on prod too
 * Paint first and look at every image before inserting. Platform-made, so no AI image credits are taken.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "../generated/prisma/index.js";
import { buildDesignedBannerSet } from "../src/services/seasonal/banner-set.js";

const STORE_SLUG = "sreerangastore";
const STORE_ID = "8f56d5c1-7a4d-4e87-8fe1-2d0b8600c839";

type Copy = { title: string; subtitle: string };
interface Cover {
  key: string;
  scene: string;
  en: Copy;
  ta: Copy;
  actionType: "CATEGORY" | "COLLECTION" | "NONE";
  actionTarget: string | null;
  endsAt: string | null;
}

// Only facts checked on prod: express delivery in 30 minutes, free delivery above ₹299, the store's live collections
const COVERS: Cover[] = [
  {
    key: "express",
    scene: "Fresh vegetables, fruit, milk and bread spilling from a paper grocery bag, bright morning light, ready for doorstep delivery",
    en: { title: "Groceries in 30 minutes", subtitle: "Sree Ranga Store, Dharmapuri" },
    ta: { title: "30 நிமிடங்களில் மளிகை", subtitle: "ஸ்ரீ ரங்கா ஸ்டோர், தர்மபுரி" },
    actionType: "CATEGORY", actionTarget: "0ebde2fe-4e99-4899-a322-3a4178fc2ceb", endsAt: null,
  },
  {
    key: "free-delivery",
    scene: "A full woven grocery basket of Indian kitchen essentials, vegetables and snacks on a clean tabletop",
    en: { title: "Free delivery above ₹299", subtitle: "Order from Sree Ranga Store" },
    ta: { title: "₹299க்கு மேல் இலவச டெலிவரி", subtitle: "ஸ்ரீ ரங்கா ஸ்டோரில் ஆர்டர் செய்யுங்கள்" },
    actionType: "NONE", actionTarget: null, endsAt: null,
  },
  {
    key: "staples",
    scene: "Unbranded sacks and glass jars of rice, wheat atta, toor dal and a bottle of cooking oil, warm kitchen pantry",
    en: { title: "Your monthly staples", subtitle: "Rice, atta, dal and oil" },
    ta: { title: "மாதாந்திர மளிகைப் பொருட்கள்", subtitle: "அரிசி, ஆட்டா, பருப்பு, எண்ணெய்" },
    actionType: "CATEGORY", actionTarget: "557a5171-9029-4fd7-8571-463795762438", endsAt: null,
  },
  {
    key: "diwali",
    scene: "Indian sweets, festive snacks, gift boxes and lit clay diyas with marigolds, warm Diwali glow",
    en: { title: "Diwali Celebration Store", subtitle: "Sweets, snacks, gifts and diyas" },
    ta: { title: "தீபாவளி கொண்டாட்டம்", subtitle: "இனிப்புகள், காரம், பரிசுகள், விளக்குகள்" },
    actionType: "COLLECTION", actionTarget: "ded1d2c4-023c-4026-8fb6-5119a8a01867", endsAt: "2026-11-08T18:29:59.000Z",
  },
  {
    key: "monsoon",
    scene: "Hot tea, a plate of crispy snacks, a folded umbrella and rain on a window, cosy rainy-day comfort",
    en: { title: "Monsoon Essentials", subtitle: "Stay stocked for the rainy days" },
    ta: { title: "மழைக்கால தேவைகள்", subtitle: "மழை நாட்களுக்குத் தயாராக இருங்கள்" },
    actionType: "COLLECTION", actionTarget: "ed440271-f87d-471b-8acd-5ee78b743c40", endsAt: "2026-12-31T18:29:59.000Z",
  },
];

type Painted = Cover & { imageUrl: string; imageUrls: Record<string, string> | null; textInImage: boolean };

async function paint(manifest: string) {
  const prisma = new PrismaClient();
  const store = await prisma.store.findUniqueOrThrow({ where: { id: STORE_ID }, select: { organizationId: true } });
  const painted: Painted[] = [];
  for (const cover of COVERS) {
    const art = await buildDesignedBannerSet(
      prisma, { organizationId: store.organizationId, purpose: "BANNER" }, cover.scene,
      { en: cover.en, ta: cover.ta }, `${STORE_SLUG}-${cover.key}`, (m) => console.log(`  ${cover.key}: ${m}`),
    );
    painted.push({ ...cover, ...art });
    console.log(`${cover.key}: ${art.imageUrl}${art.imageUrls?.ta ? `\n  ta: ${art.imageUrls.ta}` : "\n  (no Tamil)"}`);
    writeFileSync(manifest, JSON.stringify(painted, null, 2));
  }
  await prisma.$disconnect();
}

async function insertInto(prisma: PrismaClient, painted: Painted[], label: string) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: STORE_ID }, select: { organizationId: true } });
  const rows = await prisma.$transaction(painted.map((p, i) => prisma.banner.create({
    data: {
      title: p.en.title, subtitle: p.en.subtitle, imageUrl: p.imageUrl, imageUrls: p.imageUrls ?? undefined, textInImage: p.textInImage,
      placement: "HERO_CAROUSEL", actionType: p.actionType, actionTarget: p.actionTarget, sortOrder: i,
      endsAt: p.endsAt ? new Date(p.endsAt) : null, storeId: STORE_ID, organizationId: store.organizationId, sponsorType: "STORE",
    },
    select: { id: true },
  })));
  console.log(`${label}: added ${rows.length} banners`);
}

async function insert(manifest: string, prod: boolean) {
  const painted = JSON.parse(readFileSync(manifest, "utf8")) as Painted[];
  const local = new PrismaClient();
  await insertInto(local, painted, "local");
  await local.$disconnect();
  if (!prod) return;
  const remote = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });
  await insertInto(remote, painted, "PROD");
  await remote.$disconnect();
}

const [mode, manifest] = process.argv.slice(2);
if (!manifest || (mode !== "paint" && mode !== "insert")) throw new Error("Usage: store-cover-banners.ts paint|insert <manifest.json> [--prod]");
await (mode === "paint" ? paint(manifest) : insert(manifest, process.argv.includes("--prod")));
