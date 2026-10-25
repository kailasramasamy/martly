/**
 * Annachi's voice test data at Harur Fresh Mart, matching the mockups: three live posts (fresh vegetables today, wood-pressed
 * oils new this week, small onions back) and two owner's picks in Edible Oils. Posts and picks come from owner@harur.dev.
 * Translations are written here, so it works without an Anthropic key. Re-running replaces what it made.
 *
 *   cd apps/api && npx tsx prisma/seed-store-voice.ts
 */
import { PrismaClient } from "../generated/prisma/client.js";
import { expiryAfter } from "../src/services/store-voice/posts.js";

const prisma = new PrismaClient();
const HOUR_MS = 60 * 60 * 1000;

const POSTS = [
  {
    kind: "FRESH_TODAY" as const, days: 0, hoursAgo: 2,
    text: "ஊட்டி கேரட், நாட்டுத் தக்காளி இன்று காலை வந்தது. முருங்கைக்காய் பென்னாகரம் தோட்டத்திலிருந்து, இந்த வாரம் இளசு.",
    en: "Ooty carrots and country tomatoes came in this morning. Drumstick is from a Pennagaram farm, tender this week.",
    products: ["Carrot (Ooty)", "Tomato (Country)", "Drumstick"],
  },
  {
    kind: "NEW_IN_STORE" as const, days: 7, hoursAgo: 26,
    text: "Wood-pressed gingelly and groundnut oil from a Salem chekku. Take the 500 ml first and see.",
    ta: "சேலம் செக்கில் ஆட்டிய நல்லெண்ணெய், கடலை எண்ணெய் வந்துள்ளது. முதலில் 500 ml வாங்கிப் பாருங்கள்.",
    products: ["Gingelly Oil (Wood Pressed)", "Groundnut Oil (Wood Pressed)"],
  },
  {
    kind: "BACK_IN_STOCK" as const, days: 3, hoursAgo: 50,
    text: "சின்ன வெங்காயம் மீண்டும் வந்துவிட்டது, போன வாரத்தை விட ₹4 குறைவு.",
    en: "Small onions are back, ₹4 less than last week.",
    products: ["Small Onion (Shallots)"],
  },
];

const PICKS = [
  { product: "Gingelly Oil (Wood Pressed)", note: "Pressed in Salem every week. We cook with this at home.", ta: "சேலத்தில் வாரந்தோறும் ஆட்டியது. நாங்கள் வீட்டில் சமைப்பது இதில்தான்." },
  { product: "Groundnut Oil (Wood Pressed)", note: "Best for deep frying. Customers come back for it.", ta: "பொரிக்க இதுதான் சிறந்தது. வாங்கியவர்கள் மீண்டும் வருவார்கள்." },
];

async function productIds(names: string[]) {
  const rows = await prisma.product.findMany({ where: { name: { in: names }, organizationId: null }, select: { id: true, name: true } });
  return names.map((n) => {
    const row = rows.find((r) => r.name === n);
    if (!row) throw new Error(`No master product named ${n}`);
    return row.id;
  });
}

async function main() {
  const store = await prisma.store.findFirstOrThrow({ where: { name: "Harur Fresh Mart" }, select: { id: true } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@harur.dev" }, select: { id: true } });
  await prisma.storePost.deleteMany({ where: { storeId: store.id, authorId: owner.id } });
  for (const p of POSTS) {
    const ids = await productIds(p.products);
    const language = p.en ? "ta" : "en";
    const translations = p.en ? { en: { text: p.en } } : { ta: { text: p.ta! } };
    await prisma.storePost.create({
      data: {
        storeId: store.id, authorId: owner.id, kind: p.kind, text: p.text, language, translations,
        expiresAt: expiryAfter(p.days), createdAt: new Date(Date.now() - p.hoursAgo * HOUR_MS),
        products: { create: ids.map((productId, position) => ({ productId, position })) },
      },
    });
  }
  for (const pick of PICKS) {
    const [productId] = await productIds([pick.product]);
    const data = { note: pick.note, language: "en", translations: { ta: { text: pick.ta } }, authorId: owner.id };
    await prisma.storePick.upsert({ where: { storeId_productId: { storeId: store.id, productId } }, create: { storeId: store.id, productId, ...data }, update: data });
  }
  console.log(`Seeded ${POSTS.length} posts and ${PICKS.length} picks at Harur Fresh Mart`);
}

main().finally(() => prisma.$disconnect());
