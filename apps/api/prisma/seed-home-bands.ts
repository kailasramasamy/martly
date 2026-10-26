/**
 * Three pastel theme bands for Martly Template' Home, spread between the shelves below the hero banners. Each tile opens
 * one aisle the store stocks; band art is painted once and reused on reruns unless --regen-art is passed.
 * Run: npx tsx prisma/seed-home-bands.ts [--regen-art]   (set TARGET_DATABASE_URL for another DB)
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";
import { paintArt, reusableArt } from "./seed-home-art.js";
import { ORG_NAME, placeSection } from "./seed-home-collections.js";

dotenv.config({ override: true });

// seed-home-art loads apps/api/.env (overriding DATABASE_URL) as it's imported, so another database is named apart
const prisma = new PrismaClient({ datasourceUrl: process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL });

interface Band {
  title: string;
  subtitle: string;
  tint: string;
  after: string;
  art: string;
  tiles: [label: string, aisle: string][];
}

const BANDS: Band[] = [
  {
    title: "Pooja corner", subtitle: "Everything for your daily prayers", tint: "#fdf3d7", after: "Value Picks",
    art: "a brass diya with a flame, a small bundle of incense sticks with curling smoke, and a few marigold flowers",
    tiles: [["Agarbatti", "Agarbatti (Incense Sticks)"], ["Diyas & wicks", "Diya & Wicks"], ["Camphor", "Camphor (Kapur)"], ["Kumkum", "Sindoor & Kumkum"]],
  },
  {
    title: "Breakfast, sorted", subtitle: "Quick starts for busy mornings", tint: "#fde8dc", after: "Fresh Fruit Basket",
    art: "a steaming cup of South Indian filter coffee in a steel tumbler and dabarah, a bowl of oats and two slices of toast",
    tiles: [["Oats", "Oats"], ["Upma & poha", "Instant Upma & Poha"], ["Filter coffee", "Filter Coffee Powder"], ["Brown bread", "Brown & Whole Wheat Bread"]],
  },
  {
    title: "Home care refresh", subtitle: "A sparkling home, sorted in minutes", tint: "#e3eefb", after: "Shop by store",
    art: "a spray bottle of cleaner, a bucket with a mop and a few bubbles floating around them",
    tiles: [["Detergent", "Liquid Detergent"], ["Dishwash", "Dishwash Gel / Liquid"], ["Floor cleaner", "Floor Cleaner (Phenyl & Disinfectant)"], ["Fresheners", "Room Freshener Spray"]],
  },
];

async function bandArt(band: Band, organizationId: string) {
  const existing = await prisma.homeSection.findFirst({ where: { organizationId, title: band.title }, select: { config: true } });
  return reusableArt(existing?.config as Record<string, unknown> | undefined, "imageUrl") ?? await paintArt(`band-${band.title}`, [
    `A glossy cut-out illustration of ${band.art}, grouped tightly as one appealing cluster.`,
    "Soft studio light, gentle contact shadow, isolated on a fully transparent background. No text, letters, logos or people.",
  ].join("\n"), "1024x1024", true);
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  for (const band of BANDS) {
    const aisles = await prisma.subcategory.findMany({ where: { name: { in: band.tiles.map(([, aisle]) => aisle) } }, select: { id: true, name: true } });
    const items = band.tiles.flatMap(([label, aisle]) => {
      const found = aisles.find((a) => a.name === aisle);
      return found ? [{ label, subcategoryIds: [found.id] }] : [];
    });
    const imageUrl = await bandArt(band, org.id);
    await placeSection(prisma, org.id, band.after, {
      type: "THEME_BAND", title: band.title, subtitle: band.subtitle, config: { tint: band.tint, imageUrl }, items,
    });
    console.log(`${band.title}: ${items.length} tiles after "${band.after}"`);
  }
}

main().finally(() => prisma.$disconnect());
