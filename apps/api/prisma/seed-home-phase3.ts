import type { PrismaClient } from "../generated/prisma/index.js";
import { paintTiles } from "../src/services/home/tile-art.js";
import { pickProducts, upsertCollection } from "./seed-home-collections.js";
import type { PlannedSection } from "./seed-home-phase2.js";

type TileSpec = { label: string; subtitle: string; aisles: string[]; wide?: boolean };

const EXPLORE: TileSpec[] = [
  { label: "Party night", subtitle: "Chips, dips and fizz", aisles: ["Potato Chips", "Tortilla & Nachos", "Soda & Tonic Water", "Bhujia & Sev"], wide: true },
  { label: "Pooja ready", subtitle: "Everything for the altar", aisles: ["Agarbatti (Incense Sticks)", "Diya & Wicks", "Camphor (Kapur)", "Sindoor & Kumkum"] },
  { label: "Breakfast table", subtitle: "A good start", aisles: ["Oats", "Muesli & Granola", "Brown & Whole Wheat Bread", "Peanut Butter", "Jam & Marmalade"] },
  { label: "Tea time", subtitle: "Chai and something to dunk", aisles: ["Leaf & Dust Tea (CTC)", "Cashew & Butter Cookies", "Plain Rusk", "Mixture & Chivda"] },
  { label: "Healthy picks", subtitle: "Nuts, seeds and greens", aisles: ["Seeds (Chia, Flax, Pumpkin, Sunflower)", "Almonds (Badam)", "Green Tea", "Protein Drinks"] },
  { label: "Sweet cravings", subtitle: "Chocolates and mithai", aisles: ["Milk Chocolate", "Dry Sweet (Ladoo, Barfi, Peda)", "Rasgulla & Gulab Jamun"] },
  { label: "Cleaning day", subtitle: "Sparkle, top to bottom", aisles: ["Floor Cleaner (Phenyl & Disinfectant)", "Liquid Detergent", "Dishwash Gel / Liquid", "Broom & Mop"] },
  { label: "Instant meals", subtitle: "Ready in minutes", aisles: ["Instant Noodles", "Ready to Eat Meals", "Instant Upma & Poha", "Cup Noodles"] },
];

const STORES: TileSpec[] = [
  { label: "Wellness store", subtitle: "Supplements, ayurveda and first aid", aisles: ["Immunity & Supplements", "Ayurvedic Medicines", "Pain Relief (Balm, Spray)", "Cough & Cold Relief", "Digestive Care (Hajmola, ENO)"], wide: true },
  { label: "Baby store", subtitle: "Diapers, bath and feeding", aisles: ["Diaper Pants", "Baby Soap & Body Wash", "Baby Cereal", "Feeding Bottles", "Baby Wipes"], wide: true },
  { label: "Pet store", subtitle: "Food and treats", aisles: ["Dry Dog Food", "Dog Treats & Biscuits", "Wet Cat Food", "Cat Treats"] },
  { label: "Beauty store", subtitle: "Skin care and fragrance", aisles: ["Face Wash & Cleanser", "Face Serum", "Sunscreen", "Lip Balm", "Perfume & Body Mist"] },
  { label: "Home & kitchen", subtitle: "Bottles, boxes and bulbs", aisles: ["Water Bottles", "Lunch Boxes", "Storage Containers", "LED Bulbs"] },
];

const slug = (label: string) => `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-demo-grocers`;

async function tiles(prisma: PrismaClient, organizationId: string, specs: TileSpec[], perAisle: number) {
  const items = [];
  for (const spec of specs) {
    const groups = await pickProducts(prisma, spec.aisles, perAisle);
    const { collection } = await upsertCollection(prisma, organizationId, {
      slug: slug(spec.label), title: spec.label, subtitle: spec.subtitle, kind: "STANDARD", groups,
    });
    items.push({ label: spec.label, collectionId: collection.id, wide: spec.wide ?? false });
  }
  return items;
}

/** Phase 3 showcase: an Explore grid and a Shop by store grid, each tile backed by its own collection */
export async function phase3Sections(prisma: PrismaClient, organizationId: string) {
  return {
    explore: { type: "EXPLORE_GRID", title: "Explore by mood", items: await tiles(prisma, organizationId, EXPLORE, 6) },
    stores: { type: "STORE_GRID", title: "Shop by store", items: await tiles(prisma, organizationId, STORES, 8) },
  };
}

/** Tile art from before the layout was rebuilt, by label, so a re-seed doesn't repaint */
export async function previousTileArt(prisma: PrismaClient, organizationId: string) {
  const items = await prisma.homeSectionItem.findMany({
    where: { section: { organizationId, type: { in: ["EXPLORE_GRID", "STORE_GRID"] } }, imageUrl: { not: null } },
    select: { label: true, imageUrl: true },
  });
  return new Map(items.map((i) => [i.label, i.imageUrl as string]));
}

/** Restores kept art onto the new tiles, then paints the rest (all of them with `repaint`) */
export async function fillTileArt(prisma: PrismaClient, organizationId: string, kept: Map<string, string>, repaint: boolean) {
  const items = await prisma.homeSectionItem.findMany({
    where: { section: { organizationId, type: { in: ["EXPLORE_GRID", "STORE_GRID"] } } },
    select: { id: true, label: true, collectionId: true, subcategoryIds: true },
  });
  const missing = [];
  for (const item of items) {
    const art = repaint ? undefined : kept.get(item.label);
    if (art) await prisma.homeSectionItem.update({ where: { id: item.id }, data: { imageUrl: art } });
    else missing.push(item);
  }
  const painted = await paintTiles(prisma, missing);
  console.log(`Tile art: ${items.length - missing.length} kept, ${painted.length} painted`);
}
