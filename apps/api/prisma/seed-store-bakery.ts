/**
 * Harur Fresh Mart's own bakery as a store special: an org brand, eight products baked in-store (listed at that store
 * only), the "Fresh from our oven" collection with its banner, and Home's store specials card after Regional pantry
 * picks.
 * Product photos and the banner art are painted once (image model only) and reused on reruns. Safe to rerun.
 * Run: npx tsx prisma/seed-store-bakery.ts   (set TARGET_DATABASE_URL for another DB)
 */
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { storeSpecialArt } from "../src/services/seasonal/index.js";
import { paintArt } from "./seed-home-art.js";
import { ORG_NAME, STORE_ID, placeSection, upsertCollection } from "./seed-home-collections.js";

dotenv.config({ override: true });

// seed-home-art loads apps/api/.env (overriding DATABASE_URL) as it's imported, so another database is named apart
const prisma = new PrismaClient({ datasourceUrl: process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL });

const BRAND = { name: "Harur Fresh Bakes", slug: "harur-fresh-bakes" };
const COLLECTION = { slug: "fresh-from-our-oven-harur", title: "Fresh from our oven", subtitle: "Baked every morning at Harur Fresh Mart" };
const STOCK = 30;

interface Bake {
  name: string;
  ta: string;
  aisle: string;
  variant: string;
  unitType: "PIECE" | "PACK" | "GRAM";
  unitValue: number;
  mrp: number;
  price: number;
  photo: string;
}

const BAKES: Bake[] = [
  { name: "Soft Pav (6 pcs)", ta: "மென்மையான பாவ் (6)", aisle: "Pav & Bun", variant: "6 pcs", unitType: "PACK", unitValue: 6, mrp: 40, price: 35, photo: "six soft golden pav buns joined together in a tray" },
  { name: "Butter Buns", ta: "வெண்ணெய் பன்", aisle: "Buns & Rolls", variant: "4 pcs", unitType: "PACK", unitValue: 4, mrp: 45, price: 40, photo: "four glossy round butter buns with a shiny golden top" },
  { name: "Veg Puff", ta: "காய்கறி பஃப்", aisle: "Khari & Puff Pastry", variant: "1 pc", unitType: "PIECE", unitValue: 1, mrp: 25, price: 22, photo: "a flaky triangular Indian veg puff pastry, one cut open showing spiced potato filling" },
  { name: "Coconut Cookies", ta: "தேங்காய் குக்கீஸ்", aisle: "Cookies (Bakery Fresh)", variant: "200 g", unitType: "GRAM", unitValue: 200, mrp: 90, price: 80, photo: "a small stack of golden coconut cookies dusted with desiccated coconut" },
  { name: "Plain Cake Slice", ta: "பிளெயின் கேக் துண்டு", aisle: "Sliced Cake", variant: "1 slice", unitType: "PIECE", unitValue: 1, mrp: 30, price: 25, photo: "a thick slice of soft yellow vanilla tea cake" },
  { name: "Chocolate Muffins", ta: "சாக்லேட் மஃபின்", aisle: "Muffins & Cupcakes", variant: "2 pcs", unitType: "PACK", unitValue: 2, mrp: 60, price: 50, photo: "two chocolate muffins with domed tops and chocolate chips" },
  { name: "Milk Rusk", ta: "பால் ரஸ்க்", aisle: "Plain Rusk", variant: "200 g", unitType: "GRAM", unitValue: 200, mrp: 55, price: 48, photo: "a neat pile of golden crisp milk rusks" },
  { name: "Ladi Pav", ta: "லாடி பாவ்", aisle: "Pav & Bun", variant: "8 pcs", unitType: "PACK", unitValue: 8, mrp: 50, price: 45, photo: "a row of eight soft ladi pav rolls joined together, lightly floured" },
];

async function bakeryBrand(organizationId: string) {
  return prisma.brand.upsert({ where: { slug: BRAND.slug }, create: { ...BRAND, organizationId }, update: { name: BRAND.name, organizationId } });
}

// One product per bake: created once with its photo, then kept in step with the list (price, stock, names)
async function upsertBake(bake: Bake, organizationId: string, brandId: string) {
  const subcategory = await prisma.subcategory.findFirstOrThrow({ where: { name: bake.aisle }, select: { id: true } });
  const existing = await prisma.product.findFirst({ where: { organizationId, brandId, name: bake.name }, include: { variants: true } });
  const imageUrl = existing?.imageUrl ?? await paintArt(`bakery-${bake.name}`, [
    `A realistic product photo of ${bake.photo}, freshly baked in a neighbourhood bakery.`,
    "Centred on a plain pure white background, soft studio light, gentle shadow. No text, labels, logos or packaging.",
  ].join("\n"), "1024x1024", false);
  const data = {
    name: bake.name, imageUrl, images: [imageUrl], subcategoryId: subcategory.id, brandId, organizationId, foodType: "VEG" as const,
    shelfLifeDays: 2, manufacturerName: "Harur Fresh Mart", countryOfOrigin: "India", translations: { ta: { name: bake.ta } },
    description: "Baked fresh every morning in our store.",
  };
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data });
  const variantData = { name: bake.variant, unitType: bake.unitType, unitValue: bake.unitValue, mrp: bake.mrp, imageUrl };
  const variant = existing?.variants[0]
    ? await prisma.productVariant.update({ where: { id: existing.variants[0].id }, data: variantData })
    : await prisma.productVariant.create({ data: { ...variantData, productId: product.id } });
  const listing = await prisma.storeProduct.findFirst({ where: { storeId: STORE_ID, variantId: variant.id } });
  const stocked = { price: bake.price, stock: STOCK, isActive: true };
  if (listing) await prisma.storeProduct.update({ where: { id: listing.id }, data: stocked });
  else await prisma.storeProduct.create({ data: { ...stocked, storeId: STORE_ID, productId: product.id, variantId: variant.id } });
  return product.id;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  const brand = await bakeryBrand(org.id);
  const productIds: string[] = [];
  for (const bake of BAKES) productIds.push(await upsertBake(bake, org.id, brand.id));
  const { collection } = await upsertCollection(prisma, org.id, { ...COLLECTION, kind: "STORE_SPECIAL", groups: [productIds] });
  // The store specials block draws every store special as its spotlight card; it replaced an earlier plain shelf
  await prisma.homeSection.deleteMany({ where: { organizationId: org.id, type: "PRODUCT_ROW", collectionId: collection.id } });
  await placeSection(prisma, org.id, "Regional pantry picks", { type: "STORE_SPECIALS", title: "Store specials", config: {} });
  console.log(`${BRAND.name}: ${productIds.length} bakes in "${COLLECTION.title}"`);
  // Painted straight from the image model (no copy in the art), so the card and the collection screen set the title
  if (!collection.imageUrl) {
    const imageUrl = await paintArt(`store-special-${COLLECTION.slug}`, [
      await storeSpecialArt(prisma, collection),
      "A wide landscape banner photo; keep the subject in the centre band, top and bottom are cropped. No text, letters, logos or people.",
    ].join("\n"), "1536x1024", false);
    await prisma.collection.update({ where: { id: collection.id }, data: { imageUrl, imageUrls: Prisma.DbNull, textInImage: false } });
    console.log("Banner painted");
  }
}

main().finally(() => prisma.$disconnect());
