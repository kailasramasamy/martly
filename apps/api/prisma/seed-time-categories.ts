/**
 * Seed additional products into time-based recommendation categories.
 * Each category in the TIME_CATEGORY_MAP needs 4+ products for good UX.
 */
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

interface ProductDef {
  name: string;
  sku: string;
  description: string;
  price: number;
  mrp: number;
  unitValue: number;
  unitType: string;
  unitLabel: string;
  productType: string;
}

interface CategorySeed {
  categoryName: string;
  products: ProductDef[];
}

const UNIT_MAP: Record<string, string> = {
  L: "LITER", ml: "ML", kg: "KG", g: "GRAM", pcs: "PIECE", pack: "PACK",
};

const SEEDS: CategorySeed[] = [
  // ── Morning categories ──
  {
    categoryName: "Milk",
    products: [
      { name: "Mother Dairy Full Cream Milk", sku: "md-full-cream-milk", description: "Rich and creamy full cream milk", price: 68, mrp: 72, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "DAIRY" },
      { name: "Amul Gold Full Cream Milk", sku: "amul-gold-milk", description: "Amul Gold standardised milk for daily use", price: 66, mrp: 68, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "DAIRY" },
      { name: "Nandini Toned Milk", sku: "nandini-toned-milk", description: "Fresh toned milk from KMF", price: 48, mrp: 50, unitValue: 500, unitType: "ml", unitLabel: "500 ml", productType: "DAIRY" },
      { name: "Nestle a+ Toned Milk", sku: "nestle-toned-milk", description: "Nestle a+ toned milk double toned", price: 56, mrp: 60, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "DAIRY" },
    ],
  },
  {
    categoryName: "Bread",
    products: [
      { name: "Harvest Gold White Bread", sku: "harvest-gold-white", description: "Soft and fresh white bread", price: 42, mrp: 45, unitValue: 400, unitType: "g", unitLabel: "400 g", productType: "BAKERY" },
      { name: "Modern Multigrain Bread", sku: "modern-multigrain", description: "Healthy multigrain bread with seeds", price: 55, mrp: 60, unitValue: 450, unitType: "g", unitLabel: "450 g", productType: "BAKERY" },
      { name: "English Oven Sandwich Bread", sku: "english-oven-sandwich", description: "Premium sandwich bread slices", price: 52, mrp: 55, unitValue: 400, unitType: "g", unitLabel: "400 g", productType: "BAKERY" },
      { name: "Britannia Brown Bread", sku: "britannia-brown-bread", description: "100% whole wheat brown bread", price: 45, mrp: 50, unitValue: 400, unitType: "g", unitLabel: "400 g", productType: "BAKERY" },
    ],
  },
  {
    categoryName: "Butter & Ghee",
    products: [
      { name: "Amul Pure Ghee", sku: "amul-pure-ghee", description: "Amul cow ghee made from fresh cream", price: 540, mrp: 575, unitValue: 500, unitType: "ml", unitLabel: "500 ml", productType: "DAIRY" },
      { name: "Mother Dairy Cow Ghee", sku: "md-cow-ghee", description: "Pure cow ghee from Mother Dairy", price: 499, mrp: 550, unitValue: 500, unitType: "ml", unitLabel: "500 ml", productType: "DAIRY" },
      { name: "Amul Salted Butter", sku: "amul-salted-butter", description: "Amul butter with a hint of salt", price: 56, mrp: 58, unitValue: 100, unitType: "g", unitLabel: "100 g", productType: "DAIRY" },
      { name: "Britannia Cheese Slices", sku: "britannia-cheese-slices", description: "Processed cheese slices for sandwiches", price: 95, mrp: 105, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "DAIRY" },
    ],
  },
  {
    categoryName: "Tea & Coffee",
    products: [
      { name: "Tata Tea Gold", sku: "tata-tea-gold", description: "Premium blend of Assam tea for a perfect cup", price: 245, mrp: 270, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "BEVERAGES" },
      { name: "Taj Mahal Tea", sku: "taj-mahal-tea", description: "Rich and aromatic Brooke Bond tea", price: 295, mrp: 320, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "BEVERAGES" },
      { name: "Nescafe Classic Instant Coffee", sku: "nescafe-classic-coffee", description: "100% pure instant coffee", price: 310, mrp: 345, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "BEVERAGES" },
      { name: "Bru Instant Coffee", sku: "bru-instant-coffee", description: "Smooth and aromatic instant coffee", price: 275, mrp: 299, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "BEVERAGES" },
      { name: "Brooke Bond Red Label Tea", sku: "red-label-tea", description: "Natural care tea with Ayurvedic herbs", price: 210, mrp: 230, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "BEVERAGES" },
    ],
  },
  {
    categoryName: "Eggs",
    products: [
      { name: "Farm Fresh White Eggs (6 pcs)", sku: "white-eggs-6", description: "Fresh white eggs from healthy hens", price: 48, mrp: 54, unitValue: 6, unitType: "pcs", unitLabel: "6 pcs", productType: "DAIRY" },
      { name: "Country Fresh Brown Eggs (6 pcs)", sku: "brown-eggs-6", description: "Free-range brown eggs packed with nutrition", price: 65, mrp: 72, unitValue: 6, unitType: "pcs", unitLabel: "6 pcs", productType: "DAIRY" },
      { name: "Organic Free Range Eggs (6 pcs)", sku: "organic-eggs-6", description: "Certified organic free-range eggs", price: 95, mrp: 110, unitValue: 6, unitType: "pcs", unitLabel: "6 pcs", productType: "DAIRY" },
      { name: "Happy Hens Farm Eggs (12 pcs)", sku: "happy-hens-eggs-12", description: "Farm fresh eggs in a pack of 12", price: 89, mrp: 99, unitValue: 12, unitType: "pcs", unitLabel: "12 pcs", productType: "DAIRY" },
    ],
  },

  // ── Afternoon categories ──
  {
    categoryName: "Chips & Crisps",
    products: [
      { name: "Kurkure Masala Munch", sku: "kurkure-masala-munch", description: "Crunchy masala flavoured puffed snack", price: 20, mrp: 20, unitValue: 90, unitType: "g", unitLabel: "90 g", productType: "SNACKS" },
      { name: "Uncle Chipps Spicy Treat", sku: "uncle-chipps-spicy", description: "Potato chips with spicy flavour", price: 20, mrp: 20, unitValue: 55, unitType: "g", unitLabel: "55 g", productType: "SNACKS" },
      { name: "Bingo Mad Angles Achaari Masti", sku: "bingo-mad-angles", description: "Tangy achaari flavoured triangle chips", price: 20, mrp: 20, unitValue: 72, unitType: "g", unitLabel: "72 g", productType: "SNACKS" },
      { name: "Pringles Sour Cream & Onion", sku: "pringles-sour-cream", description: "Stacked potato crisps with sour cream flavour", price: 149, mrp: 159, unitValue: 107, unitType: "g", unitLabel: "107 g", productType: "SNACKS" },
    ],
  },
  {
    categoryName: "Biscuits",
    products: [
      { name: "Britannia Good Day Butter Cookies", sku: "good-day-butter", description: "Rich buttery cookies for tea time", price: 35, mrp: 40, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
      { name: "Sunfeast Dark Fantasy Choco Fills", sku: "dark-fantasy-choco", description: "Chocolate filled premium cookies", price: 40, mrp: 45, unitValue: 75, unitType: "g", unitLabel: "75 g", productType: "SNACKS" },
      { name: "McVitie's Digestive Biscuits", sku: "mcvities-digestive", description: "Wholesome wheat digestive biscuits", price: 85, mrp: 95, unitValue: 250, unitType: "g", unitLabel: "250 g", productType: "SNACKS" },
      { name: "Oreo Original Vanilla Creme", sku: "oreo-vanilla", description: "Chocolate cookie sandwich with vanilla cream", price: 30, mrp: 30, unitValue: 120, unitType: "g", unitLabel: "120 g", productType: "SNACKS" },
    ],
  },
  {
    categoryName: "Juices",
    products: [
      { name: "Real Fruit Power Mixed Fruit", sku: "real-mixed-fruit", description: "Made with real fruit juice and no added preservatives", price: 99, mrp: 110, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "BEVERAGES" },
      { name: "Paper Boat Aam Panna", sku: "paper-boat-aam-panna", description: "Traditional aam panna with raw mango", price: 30, mrp: 30, unitValue: 200, unitType: "ml", unitLabel: "200 ml", productType: "BEVERAGES" },
      { name: "B Natural Mixed Fruit Juice", sku: "bnatural-mixed-fruit", description: "100% Indian fruit juice blend", price: 90, mrp: 99, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "BEVERAGES" },
      { name: "Tropicana Apple Juice", sku: "tropicana-apple", description: "100% apple juice, no added sugar", price: 85, mrp: 95, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "BEVERAGES" },
    ],
  },
  {
    categoryName: "Ready to Eat",
    products: [
      { name: "MTR Ready to Eat Rajma Masala", sku: "mtr-rajma-masala", description: "Authentic rajma masala, heat and eat", price: 85, mrp: 95, unitValue: 300, unitType: "g", unitLabel: "300 g", productType: "GROCERY" },
      { name: "Haldiram's Minute Khana Dal Makhani", sku: "haldirams-dal-makhani", description: "Ready to eat creamy dal makhani", price: 89, mrp: 99, unitValue: 300, unitType: "g", unitLabel: "300 g", productType: "GROCERY" },
      { name: "ITC Kitchens of India Paneer Makhani", sku: "kitchens-paneer-makhani", description: "Rich and creamy paneer curry", price: 110, mrp: 125, unitValue: 285, unitType: "g", unitLabel: "285 g", productType: "GROCERY" },
      { name: "MTR Palak Paneer", sku: "mtr-palak-paneer", description: "Spinach and cottage cheese gravy", price: 79, mrp: 89, unitValue: 300, unitType: "g", unitLabel: "300 g", productType: "GROCERY" },
      { name: "Gits Ready Meals Pav Bhaji", sku: "gits-pav-bhaji", description: "Mumbais favourite street food ready to eat", price: 75, mrp: 85, unitValue: 300, unitType: "g", unitLabel: "300 g", productType: "GROCERY" },
    ],
  },

  // ── Evening categories ──
  {
    categoryName: "Vegetables",
    products: [
      { name: "Fresh Tomato", sku: "fresh-tomato", description: "Farm fresh red tomatoes", price: 35, mrp: 40, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Onion", sku: "fresh-onion", description: "Fresh red onions for daily cooking", price: 30, mrp: 35, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "FRESH_PRODUCE" },
      { name: "Fresh Potato", sku: "fresh-potato", description: "Clean and sorted potatoes", price: 32, mrp: 38, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "FRESH_PRODUCE" },
      { name: "Fresh Green Capsicum", sku: "fresh-capsicum", description: "Crispy green bell peppers", price: 25, mrp: 30, unitValue: 250, unitType: "g", unitLabel: "250 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Cucumber", sku: "fresh-cucumber", description: "Fresh and crunchy cucumbers", price: 20, mrp: 25, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
    ],
  },
  {
    categoryName: "Cooking Oil",
    products: [
      { name: "Fortune Sunlite Refined Sunflower Oil", sku: "fortune-sunflower-oil", description: "Light and healthy cooking oil", price: 175, mrp: 195, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "GROCERY" },
      { name: "Saffola Gold Cooking Oil", sku: "saffola-gold-oil", description: "Blended oil for a healthy heart", price: 199, mrp: 220, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "GROCERY" },
      { name: "Dhara Kachi Ghani Mustard Oil", sku: "dhara-mustard-oil", description: "Cold pressed mustard oil", price: 185, mrp: 199, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "GROCERY" },
      { name: "Fortune Rice Bran Health Oil", sku: "fortune-ricebran-oil", description: "Physically refined rice bran oil", price: 165, mrp: 180, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "GROCERY" },
      { name: "Nature Fresh Soyabean Oil", sku: "nature-fresh-soyabean", description: "Refined soyabean oil for daily cooking", price: 145, mrp: 160, unitValue: 1, unitType: "L", unitLabel: "1 L", productType: "GROCERY" },
    ],
  },
  {
    categoryName: "Meat",
    products: [
      { name: "Fresh Chicken Breast Boneless", sku: "chicken-breast-boneless", description: "Fresh skinless boneless chicken breast", price: 320, mrp: 360, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Chicken Curry Cut", sku: "chicken-curry-cut", description: "Skin-on curry cut chicken pieces", price: 199, mrp: 230, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Mutton Curry Cut", sku: "mutton-curry-cut", description: "Fresh goat meat curry cut with bone", price: 650, mrp: 720, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Rohu Fish", sku: "fresh-rohu-fish", description: "Cleaned and cut rohu fish", price: 280, mrp: 320, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
      { name: "Fresh Chicken Drumsticks", sku: "chicken-drumsticks", description: "Fresh chicken leg drumstick pieces", price: 225, mrp: 260, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
    ],
  },
  {
    categoryName: "Fruits",
    products: [
      { name: "Fresh Apple (Shimla)", sku: "fresh-apple-shimla", description: "Sweet and juicy Shimla apples", price: 160, mrp: 180, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "FRESH_PRODUCE" },
      { name: "Fresh Banana (Robusta)", sku: "fresh-banana", description: "Fresh ripe bananas, pack of 6", price: 40, mrp: 45, unitValue: 6, unitType: "pcs", unitLabel: "6 pcs", productType: "FRESH_PRODUCE" },
      { name: "Fresh Orange (Nagpur)", sku: "fresh-orange-nagpur", description: "Juicy Nagpur oranges", price: 80, mrp: 95, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "FRESH_PRODUCE" },
      { name: "Fresh Papaya", sku: "fresh-papaya", description: "Ripe papaya, rich in vitamins", price: 45, mrp: 55, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "FRESH_PRODUCE" },
      { name: "Fresh Pomegranate", sku: "fresh-pomegranate", description: "Ruby red juicy pomegranates", price: 120, mrp: 140, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FRESH_PRODUCE" },
    ],
  },

  // ── Night categories ──
  {
    categoryName: "Ice Cream",
    products: [
      { name: "Kwality Wall's Cornetto Butterscotch", sku: "cornetto-butterscotch", description: "Butterscotch ice cream cone with chocolate tip", price: 40, mrp: 40, unitValue: 105, unitType: "ml", unitLabel: "105 ml", productType: "FROZEN" },
      { name: "Amul Chocolate Ice Cream", sku: "amul-chocolate-icecream", description: "Rich Belgian chocolate ice cream", price: 249, mrp: 275, unitValue: 750, unitType: "ml", unitLabel: "750 ml", productType: "FROZEN" },
      { name: "Baskin Robbins Pralines & Cream", sku: "baskin-pralines-cream", description: "Premium pralines and cream ice cream", price: 199, mrp: 225, unitValue: 500, unitType: "ml", unitLabel: "500 ml", productType: "FROZEN" },
      { name: "Mother Dairy Fruit & Nut Ice Cream", sku: "md-fruit-nut-icecream", description: "Ice cream with real fruit and crunchy nuts", price: 175, mrp: 199, unitValue: 750, unitType: "ml", unitLabel: "750 ml", productType: "FROZEN" },
    ],
  },
  {
    categoryName: "Chocolates",
    products: [
      { name: "KitKat 4 Finger Chocolate", sku: "kitkat-4-finger", description: "Crispy wafer fingers covered in milk chocolate", price: 40, mrp: 40, unitValue: 37, unitType: "g", unitLabel: "37.3 g", productType: "SNACKS" },
      { name: "5 Star 3D Chocolate Bar", sku: "5star-3d-chocolate", description: "Caramel and nougat filled chocolate", price: 20, mrp: 20, unitValue: 42, unitType: "g", unitLabel: "42 g", productType: "SNACKS" },
      { name: "Ferrero Rocher Pack of 16", sku: "ferrero-rocher-16", description: "Premium hazelnut chocolate truffles", price: 549, mrp: 599, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
      { name: "Snickers Peanut Chocolate Bar", sku: "snickers-peanut-bar", description: "Peanut, nougat and caramel chocolate bar", price: 40, mrp: 40, unitValue: 45, unitType: "g", unitLabel: "45 g", productType: "SNACKS" },
    ],
  },
  {
    categoryName: "Namkeen",
    products: [
      { name: "Haldiram's Moong Dal", sku: "haldirams-moong-dal", description: "Crispy fried moong dal namkeen", price: 65, mrp: 72, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
      { name: "Bikaji Bhujia Sev", sku: "bikaji-bhujia-sev", description: "Thin and crispy besan sev", price: 55, mrp: 60, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
      { name: "Haldiram's Navratan Mixture", sku: "haldirams-navratan", description: "Royal mix of nuts, sev and flakes", price: 75, mrp: 85, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
      { name: "Bikaner's Khatta Meetha", sku: "bikaners-khatta-meetha", description: "Sweet and tangy namkeen snack", price: 60, mrp: 65, unitValue: 200, unitType: "g", unitLabel: "200 g", productType: "SNACKS" },
    ],
  },
  {
    categoryName: "Frozen Food",
    products: [
      { name: "McCain French Fries", sku: "mccain-french-fries", description: "Crispy golden french fries, ready to fry", price: 149, mrp: 170, unitValue: 420, unitType: "g", unitLabel: "420 g", productType: "FROZEN" },
      { name: "ITC Master Chef Chicken Nuggets", sku: "itc-chicken-nuggets", description: "Ready to fry chicken nuggets", price: 199, mrp: 225, unitValue: 450, unitType: "g", unitLabel: "450 g", productType: "FROZEN" },
      { name: "Godrej Yummiez Veg Burger Patty", sku: "yummiez-veg-patty", description: "Crispy vegetable burger patties", price: 145, mrp: 160, unitValue: 360, unitType: "g", unitLabel: "360 g", productType: "FROZEN" },
      { name: "Sumeru Frozen Green Peas", sku: "sumeru-frozen-peas", description: "IQF frozen green peas", price: 95, mrp: 110, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "FROZEN" },
      { name: "McCain Smiles", sku: "mccain-smiles", description: "Fun-shaped mashed potato smiles", price: 125, mrp: 140, unitValue: 415, unitType: "g", unitLabel: "415 g", productType: "FROZEN" },
    ],
  },
  {
    categoryName: "Chocolates & Sweets",
    products: [
      { name: "Haldiram's Soan Papdi", sku: "haldirams-soan-papdi", description: "Traditional flaky Indian sweet", price: 135, mrp: 150, unitValue: 500, unitType: "g", unitLabel: "500 g", productType: "SNACKS" },
      { name: "Cadbury Celebrations Premium", sku: "cadbury-celebrations-premium", description: "Assorted premium chocolate gift pack", price: 399, mrp: 450, unitValue: 281, unitType: "g", unitLabel: "281 g", productType: "SNACKS" },
      { name: "Haldiram's Gulab Jamun Tin", sku: "haldirams-gulab-jamun", description: "Ready to eat gulab jamun in sugar syrup", price: 175, mrp: 199, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "SNACKS" },
      { name: "Bikaji Rasgulla", sku: "bikaji-rasgulla", description: "Soft and spongy rasgulla in syrup", price: 145, mrp: 165, unitValue: 1, unitType: "kg", unitLabel: "1 kg", productType: "SNACKS" },
    ],
  },
];

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: "bigmart" },
    select: { id: true, organizationId: true },
  });
  const targetStore = store ?? await prisma.store.findFirstOrThrow({
    where: { status: "ACTIVE" },
    select: { id: true, organizationId: true },
  });
  console.log(`Using store: ${targetStore.id}`);

  let totalProducts = 0;
  let totalSkipped = 0;

  for (const seed of SEEDS) {
    // Find category by name (case-insensitive)
    const category = await prisma.category.findFirst({
      where: { name: { equals: seed.categoryName, mode: "insensitive" } },
    });

    if (!category) {
      console.log(`\n⚠ Category "${seed.categoryName}" not found — skipping`);
      totalSkipped += seed.products.length;
      continue;
    }

    console.log(`\n${seed.categoryName} (${category.id}):`);

    for (const p of seed.products) {
      // Skip if product with same SKU already exists
      const existingVariant = await prisma.productVariant.findFirst({
        where: { sku: p.sku },
      });
      if (existingVariant) {
        console.log(`  ✓ ${p.name} (already exists)`);
        continue;
      }

      const prismaUnitType = UNIT_MAP[p.unitType] ?? "PIECE";

      const product = await prisma.product.create({
        data: {
          name: p.name,
          description: p.description,
          categoryId: category.id,
          organizationId: targetStore.organizationId,
          isActive: true,
          productType: p.productType as any,
        },
      });

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: p.unitLabel,
          sku: p.sku,
          unitValue: p.unitValue,
          unitType: prismaUnitType as any,
          mrp: p.mrp,
        },
      });

      await prisma.storeProduct.create({
        data: {
          storeId: targetStore.id,
          productId: product.id,
          variantId: variant.id,
          price: p.price,
          stock: 20 + Math.floor(Math.random() * 80),
          reservedStock: 0,
          isActive: true,
          isFeatured: false,
        },
      });

      totalProducts++;
      console.log(`  + ${p.name} (₹${p.price})`);
    }
  }

  console.log(`\nDone! Created ${totalProducts} products, skipped ${totalSkipped}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
