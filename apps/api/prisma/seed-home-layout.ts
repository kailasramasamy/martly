/**
 * Seeds Demo Grocers' Home layout and the showcase collections behind it (idempotent; image generation reuses
 * stored art unless --regen-art is passed, and the Navratri hero is repainted only with --hero).
 *
 *   cd apps/api && npx tsx prisma/seed-home-layout.ts [--regen-art] [--hero]
 */
import "../src/load-env.js";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import { DEFAULT_LAYOUT } from "../src/services/home/default-layout.js";
import { regenerateHero } from "../src/services/seasonal/hero.js";
import { paintArt, reusableArt } from "./seed-home-art.js";
import { discount, ensurePromo, ORG_NAME, pickProducts, upsertCollection } from "./seed-home-collections.js";

const prisma = new PrismaClient();
type Config = Record<string, unknown>;
type Planned = { type: string; title?: string; subtitle?: string; collectionId?: string; config?: Config };

const PERSONAL_CARE_ID = "6ab1eb86-eafb-4b7b-9a79-6a1003126a73";
const BEST_SELLERS_ID = "ddfbfb6c-70ca-4f1c-bf64-33f6a3a4b06d";
const SNACK_AISLES = ["Potato Chips", "Bhujia & Sev", "Cream Biscuits", "Chocolate Bars & Countlines", "Cola", "Instant Noodles"];
const SNACK_PERCENTS = [25, 20, 15, 12, 18, 10];

async function previousConfigs(organizationId: string) {
  const rows = await prisma.homeSection.findMany({ where: { organizationId }, select: { title: true, config: true } });
  return new Map(rows.map((r) => [r.title, r.config as Config]));
}

async function snackFest(organizationId: string, previous: Map<string | null, Config>): Promise<Planned> {
  const groups = await pickProducts(prisma, SNACK_AISLES, 4);
  const { collection } = await upsertCollection(prisma, organizationId, {
    slug: "snack-fest-demo-grocers", title: "Snack Fest", subtitle: "Munchies for every mood", kind: "STANDARD", groups, windowDays: 3,
  });
  for (const [i, ids] of groups.entries()) await discount(prisma, ids, SNACK_PERCENTS[i], 3);
  const old = previous.get("Snack Fest");
  const imageUrl = reusableArt(old, "imageUrl") ?? await paintArt("snack-fest", [
    "A tight, cheerful group of snacks: a bowl of chips, namkeen, biscuits, chocolate bars, a cola can and a noodle cup,",
    "all fully visible and crisp, bright and appetising. Premium product-photo style with gentle studio light.",
    "Isolated objects on a fully transparent background: no backdrop, floor, surface, glow or cast shadow.",
    "No text, letters, logos or people.",
  ].join("\n"), "1536x1024", true);
  return {
    type: "CAMPAIGN_CARD", title: "Snack Fest", subtitle: "Up to 25% off on munchies", collectionId: collection.id,
    config: { offerLabel: "Up to 25% OFF", imageUrl, theme: { background: "#fef3c7", title: "#9a3412", dark: false } },
  };
}

async function personalCare(previous: Map<string | null, Config>): Promise<Planned> {
  const imageUrl = reusableArt(previous.get("Personal Care Weekend"), "imageUrl") ?? await paintArt("personal-care-weekend", [
    "A tight, appealing group of personal care products: soap bars, a shampoo bottle, face wash, a lotion pump,",
    "toothpaste, a folded towel and a few flowers, all fully visible and crisp, in soft pinks, creams and sage.",
    "Premium product-photo style with gentle studio light. Isolated objects on a fully transparent background:",
    "no backdrop, floor, surface, glow or cast shadow. No text, letters, logos or people.",
  ].join("\n"), "1536x1024", true);
  return {
    type: "CAMPAIGN_CARD", title: "Personal Care Weekend", subtitle: "Flat 20% off this weekend", collectionId: PERSONAL_CARE_ID,
    config: { offerLabel: "Flat 20% OFF", imageUrl, theme: { background: "#fce7f3", title: "#831843", dark: false } },
  };
}

async function breakfastCombo(organizationId: string, previous: Map<string | null, Config>): Promise<Planned> {
  const groups = await pickProducts(prisma, ["Brown & Whole Wheat Bread", "Full Cream Milk", "Salted Butter", "Jam & Marmalade", "Oats", "Muesli & Granola"], 2);
  const { collection, productIds } = await upsertCollection(prisma, organizationId, {
    slug: "breakfast-combo-demo-grocers", title: "Breakfast Combo", subtitle: "Start the day right", kind: "PROMO", groups, windowDays: 3,
  });
  await discount(prisma, productIds, 15, 3);
  await ensurePromo(prisma, organizationId, collection, 15);
  const imageUrl = reusableArt(previous.get("Breakfast Combo"), "imageUrl") ?? await paintArt("breakfast-combo", [
    "A tight, inviting breakfast group: a loaf of brown bread, a glass bottle of milk, a butter block, a jar of jam,",
    "a bowl of oats and a bowl of muesli, all fully visible and crisp. Premium product-photo style with gentle morning light.",
    "Isolated objects on a fully transparent background: no backdrop, table, surface, glow or cast shadow.",
    "No text, letters, logos or people.",
  ].join("\n"), "1536x1024", true);
  // A promo shows on Home by itself; placing it here gives it its own art and colours
  return {
    type: "CAMPAIGN_CARD", title: "Breakfast Combo", subtitle: "Start the day right", collectionId: collection.id,
    config: { offerLabel: "Flat 15% OFF", imageUrl, theme: { background: "#e0f2fe", title: "#075985", dark: false } },
  };
}

async function rows(organizationId: string, previous: Map<string | null, Config>) {
  const valuePicks = await upsertCollection(prisma, organizationId, {
    slug: "value-picks-demo-grocers", title: "Value Picks", subtitle: "Everyday staples", kind: "STANDARD",
    groups: await pickProducts(prisma, ["Wheat Atta", "Basmati Rice", "Sunflower Oil", "Salted Butter", "Oats", "Tea Bags"], 2),
  });
  const fruit = await upsertCollection(prisma, organizationId, {
    slug: "fresh-fruit-basket-demo-grocers", title: "Fresh Fruit Basket", subtitle: "Picked for freshness", kind: "STANDARD",
    groups: await pickProducts(prisma, ["Banana", "Apple", "Grapes"], 4),
  });
  const fruitArt = reusableArt(previous.get("Fresh Fruit Basket"), "headerImageUrl") ?? await paintArt("fruit-basket", [
    "A glossy cut-out illustration of a wicker basket overflowing with fresh apples, bananas, grapes and oranges.",
    "Soft studio light, gentle contact shadow, isolated on a fully transparent background. No text, logos or people.",
  ].join("\n"), "1024x1024", true);
  const bestArt = reusableArt(previous.get("Best Sellers"), "headerImageUrl") ?? await paintArt("best-sellers", [
    "A glossy cut-out illustration of a golden star medal with a ribbon, with a few fruits and snacks around it, celebrating the most loved products.",
    "Isolated on a fully transparent background, soft studio light. No text, letters, logos or people.",
  ].join("\n"), "1024x1024", true);
  return {
    best: { type: "PRODUCT_ROW", title: "Best Sellers", collectionId: BEST_SELLERS_ID, config: { headerStyle: "ARTWORK", headerImageUrl: bestArt, tint: "#fef3c7", maxProducts: 12 } } as Planned,
    value: { type: "PRODUCT_ROW", title: "Value Picks", collectionId: valuePicks.collection.id, config: { headerStyle: "PLAIN", maxProducts: 12 } } as Planned,
    fruit: { type: "PRODUCT_ROW", title: "Fresh Fruit Basket", collectionId: fruit.collection.id, config: { headerStyle: "BANNER", headerImageUrl: fruitArt, tint: "#dcfce7", maxProducts: 12 } } as Planned,
  };
}

async function repaintNavratri(organizationId: string) {
  const collection = await prisma.collection.findFirst({
    where: { organizationId, slug: { startsWith: "navratri" } }, include: { festivalEvent: { select: { name: true, guidance: true } } },
  });
  if (!collection) return console.log("No Navratri collection to repaint");
  const hero = await regenerateHero(prisma, { ...collection, organizationId });
  console.log(hero ? `Navratri hero repainted: ${hero.heroImageUrl}` : "Navratri hero could not be filled");
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  const previous = await previousConfigs(org.id) as Map<string | null, Config>;
  const [pcw, snack, combo, r] = [await personalCare(previous), await snackFest(org.id, previous), await breakfastCombo(org.id, previous), await rows(org.id, previous)];

  // Default order with the showcase sections slotted in
  const plan: Planned[] = DEFAULT_LAYOUT.flatMap((e) => {
    const base: Planned = { type: e.type };
    if (e.type === "MEMBER_CHIPS") return [base, pcw, snack, combo];
    if (e.type === "BUY_AGAIN") return [base, r.best, r.value, r.fruit];
    return [base];
  });
  await prisma.$transaction([
    prisma.homeSection.deleteMany({ where: { organizationId: org.id } }),
    prisma.homeSection.createMany({
      data: plan.map((p, sortOrder) => ({
        organizationId: org.id, type: p.type as never, title: p.title, subtitle: p.subtitle, collectionId: p.collectionId,
        config: (p.config ?? {}) as Prisma.InputJsonValue, sortOrder,
      })),
    }),
  ]);
  const saved = await prisma.homeSection.findMany({ where: { organizationId: org.id }, orderBy: { sortOrder: "asc" }, select: { id: true, type: true, title: true, config: true } });
  console.log(`Layout: ${saved.length} sections`);
  for (const s of saved.filter((x) => x.title)) console.log(`  ${s.type} "${s.title}" ${s.id} ${JSON.stringify(s.config)}`);
  if (process.argv.includes("--hero")) await repaintNavratri(org.id);
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
