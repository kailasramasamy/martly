/**
 * Festival calendar for the seasonal curation agent: pan-India and Tamil Nadu events for Oct 2026 – Oct 2027.
 * Lunar dates were checked against Drik Panchang (Oct 2026); Eid is tentative on moon sighting.
 * Also links the hand-made collections from seed-search-landing.ts to their events so the agent doesn't
 * duplicate them, and opts orgs still on the default pan-India calendar into Tamil Nadu (every store is in TN).
 * Run: cd apps/api && npx tsx prisma/seed-festival-calendar.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

interface SeedEvent {
  slug: string;
  name: string;
  kind: "OCCASION" | "SEASON";
  startsAt: string;
  endsAt: string;
  leadDays: number;
  regions: string[];
  guidance?: string;
  linkCollection?: string;
}

const VEG = "Observed vegetarian by most households: no meat, fish or eggs.";

const EVENTS: SeedEvent[] = [
  { slug: "diwali-2026", name: "Diwali", kind: "OCCASION", startsAt: "2026-11-07", endsAt: "2026-11-08", leadDays: 21, regions: ["ALL"],
    guidance: `In Tamil Nadu, Deepavali is celebrated on Naraka Chaturdashi morning with oil bath, new clothes, crackers and homemade sweets and savouries. Sweets, dry fruits, gift packs, ghee, oil, besan, diyas and pooja items. ${VEG}`,
    linkCollection: "diwali-specials-2026" },
  { slug: "karthigai-deepam-2026", name: "Karthigai Deepam", kind: "OCCASION", startsAt: "2026-11-24", endsAt: "2026-11-24", leadDays: 7, regions: ["TN"],
    guidance: `Festival of lamps: rows of clay agal vilakku with ghee or sesame oil and cotton wicks, camphor, flowers. Traditional sweets are pori urundai (puffed rice with jaggery), appam and adai. ${VEG}` },
  { slug: "northeast-monsoon-2026", name: "Northeast Monsoon", kind: "SEASON", startsAt: "2026-10-20", endsAt: "2026-12-15", leadDays: 0, regions: ["TN"],
    guidance: "Tamil Nadu's main rainy season. Hot drinks, soups, instant snacks for power cuts, candles and torches, mosquito repellents, cold and cough remedies, staples to stock up when it pours." },
  { slug: "christmas-new-year-2026", name: "Christmas & New Year", kind: "OCCASION", startsAt: "2026-12-24", endsAt: "2027-01-01", leadDays: 7, regions: ["ALL"],
    guidance: "Plum cakes, baking supplies, chocolates, party snacks, soft drinks and mixers (no alcohol), decorations.",
    linkCollection: "christmas-new-year-2026" },
  { slug: "pongal-2027", name: "Pongal", kind: "OCCASION", startsAt: "2027-01-13", endsAt: "2027-01-16", leadDays: 7, regions: ["TN"],
    guidance: `Bhogi, Thai Pongal and Mattu Pongal. Sakkarai and ven pongal need raw rice, moong dal, jaggery, ghee, cashews, raisins, cardamom; also sugarcane, turmeric, kolam colours, new pots and pooja items. ${VEG}`,
    linkCollection: "pongal-essentials-2027" },
  { slug: "maha-shivaratri-2027", name: "Maha Shivaratri", kind: "OCCASION", startsAt: "2027-03-06", endsAt: "2027-03-06", leadDays: 5, regions: ["ALL"],
    guidance: `Night-long vigil and fasting. Fasting foods (fruits, milk, sabudana, dry fruits, peanuts), pooja items, camphor, ghee lamps, flowers. ${VEG}` },
  { slug: "ramzan-eid-2027", name: "Ramzan (Eid ul-Fitr)", kind: "OCCASION", startsAt: "2027-03-10", endsAt: "2027-03-10", leadDays: 10, regions: ["ALL"],
    guidance: "Date tentative on moon sighting. Iftar and Eid feast: dates, dry fruits, vermicelli and milk for sheer khurma, basmati rice, biryani masala, ghee, fresh chicken and mutton, rose syrup, attar-free gift packs." },
  { slug: "holi-2027", name: "Holi", kind: "OCCASION", startsAt: "2027-03-22", endsAt: "2027-03-22", leadDays: 7, regions: ["MH", "GJ", "DL", "UP", "PB", "WB"],
    guidance: "Gujiya ingredients, sweets, thandai, snacks, soft drinks, herbal colours." },
  { slug: "tamil-new-year-2027", name: "Tamil New Year (Puthandu)", kind: "OCCASION", startsAt: "2027-04-14", endsAt: "2027-04-14", leadDays: 7, regions: ["TN"],
    guidance: `Feast with mango pachadi (raw mango, jaggery, neem flower), payasam, vadai. Fruits for the kanni tray, pooja items, rice, dals, ghee. ${VEG}` },
  { slug: "aadi-perukku-2027", name: "Aadi Perukku", kind: "OCCASION", startsAt: "2027-08-03", endsAt: "2027-08-03", leadDays: 5, regions: ["TN"],
    guidance: `Monsoon river festival. Variety rice is the tradition: lemon rice, tamarind rice, coconut rice, curd rice, sweet pongal; also turmeric, kumkum and flowers. ${VEG}` },
  { slug: "vinayagar-chathurthi-2027", name: "Vinayagar Chathurthi", kind: "OCCASION", startsAt: "2027-09-04", endsAt: "2027-09-04", leadDays: 7, regions: ["ALL"],
    guidance: `Kozhukattai/modak needs rice flour, jaggery, grated coconut, sesame and cardamom; also sundal (chickpeas), fruits, flowers, pooja items. ${VEG}` },
  { slug: "purattasi-2027", name: "Purattasi Month", kind: "SEASON", startsAt: "2027-09-17", endsAt: "2027-10-17", leadDays: 3, regions: ["TN"],
    guidance: `A month many Tamil households keep strictly vegetarian, with Saturday Perumal worship. Vegetarian staples, paneer, mushrooms, dals, tulsi and pooja items. ${VEG}` },
  { slug: "navaratri-2027", name: "Navaratri & Ayudha Pooja", kind: "OCCASION", startsAt: "2027-09-30", endsAt: "2027-10-09", leadDays: 7, regions: ["ALL"],
    guidance: `Golu displays and a different sundal every evening (chickpeas, green gram, peanuts, black-eyed peas), fruits, betel leaves, coconut, pooja items; Ayudha Pooja needs banana, puffed rice, sugarcane, camphor, kumkum. ${VEG}` },
  { slug: "winter-2026", name: "Winter", kind: "SEASON", startsAt: "2026-11-01", endsAt: "2027-02-28", leadDays: 0, regions: ["ALL"],
    guidance: "Warm drinks, soups, honey, dry fruits, immunity and cold-care products, moisturisers.",
    linkCollection: "winter-warmers-2026" },
  { slug: "summer-2027", name: "Summer", kind: "SEASON", startsAt: "2027-03-15", endsAt: "2027-06-15", leadDays: 0, regions: ["ALL"],
    guidance: "Coolers: ice cream, juices, buttermilk, lassi, sharbat, coconut water, curd, cucumber, watermelon, sunscreen, talc.",
    linkCollection: "summer-coolers-2027" },
];

const istMidnight = (day: string) => new Date(`${day}T00:00:00+05:30`);
const istEndOfDay = (day: string) => new Date(`${day}T23:59:59.999+05:30`);

async function main() {
  const opted = await prisma.organization.updateMany({
    where: { festivalRegions: { equals: ["ALL"] } },
    data: { festivalRegions: ["ALL", "TN"] },
  });
  console.log(`${opted.count} org(s) now follow ALL + TN`);

  for (const { linkCollection, ...e } of EVENTS) {
    const data = { ...e, startsAt: istMidnight(e.startsAt), endsAt: istEndOfDay(e.endsAt) };
    const event = await prisma.festivalEvent.upsert({ where: { slug: e.slug }, update: data, create: data });
    const linked = linkCollection
      ? await prisma.collection.updateMany({ where: { slug: linkCollection, festivalEventId: null }, data: { festivalEventId: event.id } })
      : { count: 0 };
    console.log(`  ${e.kind.padEnd(8)} ${e.name.padEnd(28)} ${e.startsAt} → ${e.endsAt}  [${e.regions.join(",")}]${linked.count ? " (linked)" : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
