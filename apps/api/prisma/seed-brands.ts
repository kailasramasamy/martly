import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const BRANDS = [
  // Dairy
  "Amul", "Mother Dairy", "Nandini", "Verka", "Milma",
  // Staples & Spices
  "Tata", "Aashirvaad", "Fortune", "MDH", "Everest", "Catch", "Eastern", "Saffola",
  // Snacks & Biscuits
  "Haldiram's", "Parle", "Britannia", "ITC", "Lay's", "Kurkure", "Bingo!", "Too Yumm!",
  // Beverages
  "Nescafe", "Bru", "Tata Tea", "Red Label", "Brooke Bond", "Tropicana", "Real", "Paper Boat",
  "Pepsi", "Coca-Cola", "Thums Up", "Bisleri", "Kinley",
  // Instant & Ready-to-eat
  "Maggi", "Yippee!", "Knorr", "MTR", "Gits", "Saffola FITTIFY",
  // Cooking Oils & Ghee
  "Dhara", "Sundrop", "Dalda", "Patanjali",
  // Personal Care
  "Dabur", "Himalaya", "Mamaearth", "Dove", "Nivea", "Lux", "Lifebuoy", "Dettol",
  "Pears", "Cinthol", "Santoor", "Medimix",
  // Hair Care
  "Head & Shoulders", "Clinic Plus", "Sunsilk", "Pantene", "Parachute",
  // Oral Care
  "Colgate", "Closeup", "Pepsodent", "Sensodyne", "Patanjali Dant Kanti",
  // Household
  "Surf Excel", "Rin", "Tide", "Ariel", "Vim", "Harpic", "Lizol", "Domex",
  "Good Knight", "All Out", "Mortein",
  // Baby Care
  "Johnson's Baby", "Pampers", "Huggies", "Cerelac", "Nestlé",
  // Health & Wellness
  "Vicks", "Crocin", "Moov", "Zandu", "Chyawanprash",
  // Pet Care
  "Pedigree", "Whiskas", "Drools",
  // Organic & Health Foods
  "Organic Tattva", "24 Mantra", "Pro Nature", "Yogabar", "True Elements",
  // Frozen & Packaged
  "McCain", "Godrej Yummiez", "Sumeru", "ITC Master Chef",
  // Sweets & Chocolates
  "Cadbury", "5 Star", "KitKat", "Ferrero Rocher", "Amul Chocolates",
  // Atta & Flour
  "Pillsbury", "Rajdhani",
  // Rice
  "India Gate", "Daawat", "Kohinoor",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log(`Seeding ${BRANDS.length} brands...`);

  let created = 0;
  let skipped = 0;

  for (const name of BRANDS) {
    const slug = slugify(name);
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.brand.create({ data: { name, slug } });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
