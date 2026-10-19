import type { PrismaClient } from "../generated/prisma/index.js";

type Item = { label: string; collectionId: string };
export type PlannedSection = {
  type: string; title?: string; subtitle?: string; collectionId?: string; config?: Record<string, unknown>; items?: Item[];
};

const TAB_COLLECTIONS = ["Snack Time", "Morning Essentials", "Monsoon Essentials", "Value Picks"];
const DIRECTORY_DEPARTMENTS = ["Grocery & Staples", "Snacks & Packaged Foods", "Beverages", "Personal Care", "Home Care"];
const BRAND_CARDS = [
  { name: "Cadbury (Mondelez)", title: "Cadbury Celebrations", subtitle: "Something sweet for every moment", tint: "#ede9fe" },
  { name: "Amul", title: "The Taste of India", subtitle: "Milk, butter, cheese and more from Amul", tint: "#fef3c7" },
];

async function tabbedRow(prisma: PrismaClient, organizationId: string): Promise<PlannedSection> {
  const collections = await prisma.collection.findMany({
    where: { organizationId, title: { in: TAB_COLLECTIONS }, isActive: true }, select: { id: true, title: true },
  });
  const items = TAB_COLLECTIONS.flatMap((title) => {
    const c = collections.find((x) => x.title === title);
    return c ? [{ label: title, collectionId: c.id }] : [];
  });
  return { type: "TABBED_ROW", title: "Everyday picks", subtitle: "Handy things you reach for daily", config: { tabStyle: "ICON_CARD", tint: "#e0f2fe" }, items };
}

async function brandCards(prisma: PrismaClient): Promise<PlannedSection[]> {
  const brands = await prisma.brand.findMany({ where: { name: { in: BRAND_CARDS.map((b) => b.name) } }, select: { id: true, name: true } });
  return BRAND_CARDS.flatMap((b) => {
    const brand = brands.find((x) => x.name === b.name);
    return brand ? [{ type: "BRAND_CARD", title: b.title, subtitle: b.subtitle, config: { brandId: brand.id, tint: b.tint } }] : [];
  });
}

async function directory(prisma: PrismaClient): Promise<PlannedSection> {
  const departments = await prisma.department.findMany({ where: { name: { in: DIRECTORY_DEPARTMENTS } }, select: { id: true, name: true } });
  const departmentIds = DIRECTORY_DEPARTMENTS.flatMap((n) => departments.filter((d) => d.name === n).map((d) => d.id));
  return { type: "CATEGORY_DIRECTORY", title: "Shop by aisle", config: { departmentIds } };
}

/** Phase 2 showcase: a tabbed row, price-band deals, two brand cards and a category directory */
export async function phase2Sections(prisma: PrismaClient, organizationId: string) {
  return {
    tabs: await tabbedRow(prisma, organizationId),
    deals: {
      type: "PRICE_BAND_DEALS", title: "Pocket-friendly deals", config: {
        headline: "Add any 10 items",
        bands: [{ label: "Under ₹19", maxPrice: 19 }, { label: "Under ₹29", maxPrice: 29 }, { label: "Under ₹49", maxPrice: 49 }, { label: "Under ₹99", maxPrice: 99 }],
      },
    } as PlannedSection,
    brands: await brandCards(prisma),
    directory: await directory(prisma),
  };
}
