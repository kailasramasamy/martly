import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- DATA ----------

interface GrandchildDef {
  name: string;
}

interface VariantDef {
  name: string;
  unitType: string;
  unitValue: number;
  mrp: number;
  packType?: string;
}

interface ProductDef {
  name: string;
  grandchild: string; // grandchild name
  brand?: string; // brand name (must exist in DB)
  foodType?: string;
  productType?: string;
  storageType?: string;
  description?: string;
  variants: VariantDef[];
}

interface SubcategoryData {
  grandchildren: GrandchildDef[];
  products: ProductDef[];
}

// ==================== FOOD ====================
const FOOD: Record<string, SubcategoryData> = {
  Fruits: {
    grandchildren: [
      { name: "Seasonal Fruits" },
      { name: "Exotic Fruits" },
      { name: "Citrus Fruits" },
      { name: "Everyday Fruits" },
    ],
    products: [
      {
        name: "Alphonso Mango",
        grandchild: "Seasonal Fruits",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Premium Ratnagiri Alphonso mangoes, naturally ripened",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 600 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 350 },
        ],
      },
      {
        name: "Imported Kiwi",
        grandchild: "Exotic Fruits",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Fresh imported green kiwi fruit, rich in Vitamin C",
        variants: [
          { name: "3 pc", unitType: "PIECE", unitValue: 3, mrp: 150 },
        ],
      },
      {
        name: "Nagpur Orange",
        grandchild: "Citrus Fruits",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "AMBIENT",
        description: "Sweet and juicy Nagpur oranges",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 80 },
        ],
      },
      {
        name: "Banana Robusta",
        grandchild: "Everyday Fruits",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "AMBIENT",
        description: "Fresh robusta bananas, perfect for daily consumption",
        variants: [
          { name: "1 dozen", unitType: "DOZEN", unitValue: 1, mrp: 50 },
          { name: "6 pc", unitType: "PIECE", unitValue: 6, mrp: 30 },
        ],
      },
    ],
  },

  Vegetables: {
    grandchildren: [
      { name: "Leafy Greens" },
      { name: "Root Vegetables" },
      { name: "Gourds & Squash" },
      { name: "Everyday Vegetables" },
    ],
    products: [
      {
        name: "Fresh Spinach (Palak)",
        grandchild: "Leafy Greens",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Farm-fresh spinach leaves, washed and cleaned",
        variants: [
          { name: "250 g bunch", unitType: "GRAM", unitValue: 250, mrp: 30 },
        ],
      },
      {
        name: "Ooty Carrot",
        grandchild: "Root Vegetables",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Fresh Ooty carrots, sweet and crunchy",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 40 },
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 70 },
        ],
      },
      {
        name: "Bottle Gourd (Lauki)",
        grandchild: "Gourds & Squash",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "AMBIENT",
        description: "Fresh bottle gourd, ideal for sabzi and dal",
        variants: [
          { name: "1 pc", unitType: "PIECE", unitValue: 1, mrp: 35 },
        ],
      },
      {
        name: "Onion",
        grandchild: "Everyday Vegetables",
        foodType: "VEG",
        productType: "FRESH_PRODUCE",
        storageType: "AMBIENT",
        description: "Fresh medium-sized onions, kitchen essential",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 40 },
          { name: "2 kg", unitType: "KG", unitValue: 2, mrp: 75 },
        ],
      },
    ],
  },

  Dairy: {
    grandchildren: [
      { name: "Milk" },
      { name: "Curd & Yogurt" },
      { name: "Paneer & Cheese" },
      { name: "Butter & Ghee" },
    ],
    products: [
      {
        name: "Amul Taaza Toned Milk",
        grandchild: "Milk",
        brand: "Amul",
        foodType: "VEG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Amul Taaza homogenized toned milk, pasteurized",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 30 },
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 56 },
        ],
      },
      {
        name: "Mother Dairy Classic Curd",
        grandchild: "Curd & Yogurt",
        brand: "Mother Dairy",
        foodType: "VEG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Thick and creamy set curd, made from toned milk",
        variants: [
          { name: "400 g", unitType: "GRAM", unitValue: 400, mrp: 35 },
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 75 },
        ],
      },
      {
        name: "Amul Fresh Paneer",
        grandchild: "Paneer & Cheese",
        brand: "Amul",
        foodType: "VEG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Fresh and soft paneer block, made from cow milk",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 90 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 210 },
        ],
      },
      {
        name: "Amul Pasteurised Butter",
        grandchild: "Butter & Ghee",
        brand: "Amul",
        foodType: "VEG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Utterly butterly delicious Amul butter",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 56 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 270 },
        ],
      },
    ],
  },

  "Grains & Cereals": {
    grandchildren: [
      { name: "Rice" },
      { name: "Wheat & Atta" },
      { name: "Poha & Flakes" },
      { name: "Muesli & Oats" },
    ],
    products: [
      {
        name: "India Gate Basmati Rice",
        grandchild: "Rice",
        brand: "India Gate",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Premium aged basmati rice, extra long grain",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 180 },
          { name: "5 kg", unitType: "KG", unitValue: 5, mrp: 850 },
        ],
      },
      {
        name: "Aashirvaad Superior MP Atta",
        grandchild: "Wheat & Atta",
        brand: "Aashirvaad",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "100% whole wheat atta, soft rotis every time",
        variants: [
          { name: "5 kg", unitType: "KG", unitValue: 5, mrp: 280 },
          { name: "10 kg", unitType: "KG", unitValue: 10, mrp: 530 },
        ],
      },
      {
        name: "Thick Poha",
        grandchild: "Poha & Flakes",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Medium-thick flattened rice for poha and chivda",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 45 },
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 80 },
        ],
      },
      {
        name: "Yogabar Crunchy Muesli",
        grandchild: "Muesli & Oats",
        brand: "Yogabar",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Dark chocolate and cranberry muesli with whole grains",
        variants: [
          { name: "400 g", unitType: "GRAM", unitValue: 400, mrp: 299 },
          { name: "700 g", unitType: "GRAM", unitValue: 700, mrp: 499 },
        ],
      },
    ],
  },

  "Cooking Oil": {
    grandchildren: [
      { name: "Sunflower Oil" },
      { name: "Mustard Oil" },
      { name: "Olive Oil" },
      { name: "Coconut Oil" },
    ],
    products: [
      {
        name: "Fortune Sunlite Sunflower Oil",
        grandchild: "Sunflower Oil",
        brand: "Fortune",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Refined sunflower oil, light and healthy",
        variants: [
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 155 },
          { name: "5 L", unitType: "LITER", unitValue: 5, mrp: 720 },
        ],
      },
      {
        name: "Dhara Kachi Ghani Mustard Oil",
        grandchild: "Mustard Oil",
        brand: "Dhara",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Cold-pressed mustard oil with pungent aroma",
        variants: [
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 190 },
        ],
      },
      {
        name: "Saffola Aura Olive Oil",
        grandchild: "Olive Oil",
        brand: "Saffola",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Extra virgin olive oil for salads and light cooking",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 450 },
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 850 },
        ],
      },
      {
        name: "Parachute Pure Coconut Oil",
        grandchild: "Coconut Oil",
        brand: "Parachute",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "100% pure coconut oil for cooking and hair care",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 130 },
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 245 },
        ],
      },
    ],
  },

  "Spices & Masala": {
    grandchildren: [
      { name: "Whole Spices" },
      { name: "Ground Spices" },
      { name: "Blended Masala" },
      { name: "Seasonings" },
    ],
    products: [
      {
        name: "MDH Whole Coriander Seeds",
        grandchild: "Whole Spices",
        brand: "MDH",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Premium quality whole coriander seeds",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 45 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 190 },
        ],
      },
      {
        name: "Everest Turmeric Powder",
        grandchild: "Ground Spices",
        brand: "Everest",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Pure turmeric powder with high curcumin content",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 42 },
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 78 },
        ],
      },
      {
        name: "MDH Deggi Mirch",
        grandchild: "Blended Masala",
        brand: "MDH",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Bright red chilli powder blend for rich colour",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 65 },
        ],
      },
      {
        name: "Catch Chaat Masala",
        grandchild: "Seasonings",
        brand: "Catch",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Tangy chaat masala sprinkler for snacks and fruits",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 55 },
          { name: "50 g sprinkler", unitType: "GRAM", unitValue: 50, mrp: 35 },
        ],
      },
    ],
  },

  Snacks: {
    grandchildren: [
      { name: "Chips & Crisps" },
      { name: "Namkeen" },
      { name: "Biscuits" },
      { name: "Instant Noodles" },
    ],
    products: [
      {
        name: "Lay's Classic Salted Chips",
        grandchild: "Chips & Crisps",
        brand: "Lay's",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Thin and crispy potato chips, classic salted flavour",
        variants: [
          { name: "52 g", unitType: "GRAM", unitValue: 52, mrp: 20 },
          { name: "115 g", unitType: "GRAM", unitValue: 115, mrp: 50 },
        ],
      },
      {
        name: "Haldiram's Aloo Bhujia",
        grandchild: "Namkeen",
        brand: "Haldiram's",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Classic crispy aloo bhujia namkeen",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 60 },
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 260 },
        ],
      },
      {
        name: "Parle-G Gold Biscuits",
        grandchild: "Biscuits",
        brand: "Parle",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Premium glucose biscuits with extra butter",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 20 },
          { name: "1 kg pack", unitType: "KG", unitValue: 1, mrp: 150 },
        ],
      },
      {
        name: "Maggi 2-Minute Masala Noodles",
        grandchild: "Instant Noodles",
        brand: "Maggi",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "India's favourite instant noodles with tastemaker",
        variants: [
          { name: "70 g single", unitType: "GRAM", unitValue: 70, mrp: 14 },
          { name: "4 pack", unitType: "PACK", unitValue: 4, mrp: 56, packType: "Multipack" },
          { name: "12 pack", unitType: "PACK", unitValue: 12, mrp: 168, packType: "Family Pack" },
        ],
      },
    ],
  },

  Beverages: {
    grandchildren: [
      { name: "Soft Drinks" },
      { name: "Juices" },
      { name: "Packaged Water" },
      { name: "Traditional Drinks" },
    ],
    products: [
      {
        name: "Coca-Cola Original",
        grandchild: "Soft Drinks",
        brand: "Coca-Cola",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "REFRIGERATED",
        description: "Classic Coca-Cola carbonated soft drink",
        variants: [
          { name: "300 ml", unitType: "ML", unitValue: 300, mrp: 35 },
          { name: "750 ml", unitType: "ML", unitValue: 750, mrp: 45 },
          { name: "2 L", unitType: "LITER", unitValue: 2, mrp: 96 },
        ],
      },
      {
        name: "Tropicana Orange Juice",
        grandchild: "Juices",
        brand: "Tropicana",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "REFRIGERATED",
        description: "100% orange juice, no added sugar",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 30 },
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 120 },
        ],
      },
      {
        name: "Bisleri Mineral Water",
        grandchild: "Packaged Water",
        brand: "Bisleri",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "AMBIENT",
        description: "Purified drinking water with added minerals",
        variants: [
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 22 },
          { name: "5 L jar", unitType: "LITER", unitValue: 5, mrp: 65 },
        ],
      },
      {
        name: "Paper Boat Aam Panna",
        grandchild: "Traditional Drinks",
        brand: "Paper Boat",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "AMBIENT",
        description: "Traditional raw mango drink, refreshing summer cooler",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 30 },
        ],
      },
    ],
  },

  "Frozen Food": {
    grandchildren: [
      { name: "Frozen Snacks" },
      { name: "Frozen Vegetables" },
      { name: "Ice Cream" },
      { name: "Frozen Ready Meals" },
    ],
    products: [
      {
        name: "McCain French Fries",
        grandchild: "Frozen Snacks",
        brand: "McCain",
        foodType: "VEG",
        productType: "FROZEN",
        storageType: "FROZEN",
        description: "Crispy golden french fries, oven or deep fry",
        variants: [
          { name: "420 g", unitType: "GRAM", unitValue: 420, mrp: 155 },
          { name: "750 g", unitType: "GRAM", unitValue: 750, mrp: 250 },
        ],
      },
      {
        name: "Sumeru Frozen Green Peas",
        grandchild: "Frozen Vegetables",
        brand: "Sumeru",
        foodType: "VEG",
        productType: "FROZEN",
        storageType: "FROZEN",
        description: "Farm-fresh green peas, individually quick frozen",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 110 },
        ],
      },
      {
        name: "Amul Vanilla Ice Cream",
        grandchild: "Ice Cream",
        brand: "Amul",
        foodType: "VEG",
        productType: "FROZEN",
        storageType: "FROZEN",
        description: "Creamy vanilla ice cream with real vanilla flavour",
        variants: [
          { name: "500 ml tub", unitType: "ML", unitValue: 500, mrp: 130 },
          { name: "1 L tub", unitType: "LITER", unitValue: 1, mrp: 240 },
        ],
      },
      {
        name: "Godrej Yummiez Veg Burger Patty",
        grandchild: "Frozen Ready Meals",
        brand: "Godrej Yummiez",
        foodType: "VEG",
        productType: "FROZEN",
        storageType: "FROZEN",
        description: "Ready-to-cook vegetable burger patties",
        variants: [
          { name: "360 g (6 pc)", unitType: "GRAM", unitValue: 360, mrp: 180 },
        ],
      },
    ],
  },

  Bakery: {
    grandchildren: [
      { name: "Bread" },
      { name: "Cakes & Pastries" },
      { name: "Rusk & Toast" },
      { name: "Cookies" },
    ],
    products: [
      {
        name: "Britannia White Bread",
        grandchild: "Bread",
        brand: "Britannia",
        foodType: "VEG",
        productType: "BAKERY",
        storageType: "AMBIENT",
        description: "Soft and fresh white sandwich bread",
        variants: [
          { name: "400 g", unitType: "GRAM", unitValue: 400, mrp: 40 },
          { name: "700 g family pack", unitType: "GRAM", unitValue: 700, mrp: 60 },
        ],
      },
      {
        name: "Britannia Fruit Cake",
        grandchild: "Cakes & Pastries",
        brand: "Britannia",
        foodType: "EGG",
        productType: "BAKERY",
        storageType: "AMBIENT",
        description: "Classic fruit cake with candied fruits and raisins",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 80 },
        ],
      },
      {
        name: "Parle Premium Rusk",
        grandchild: "Rusk & Toast",
        brand: "Parle",
        foodType: "VEG",
        productType: "BAKERY",
        storageType: "AMBIENT",
        description: "Crispy and crunchy premium suji rusk",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 42 },
          { name: "600 g", unitType: "GRAM", unitValue: 600, mrp: 78 },
        ],
      },
      {
        name: "Britannia Good Day Cashew Cookies",
        grandchild: "Cookies",
        brand: "Britannia",
        foodType: "VEG",
        productType: "BAKERY",
        storageType: "AMBIENT",
        description: "Butter cookies loaded with crunchy cashew bits",
        variants: [
          { name: "120 g", unitType: "GRAM", unitValue: 120, mrp: 35 },
          { name: "600 g party pack", unitType: "GRAM", unitValue: 600, mrp: 150 },
        ],
      },
    ],
  },

  "Pulses & Lentils": {
    grandchildren: [
      { name: "Toor Dal" },
      { name: "Moong Dal" },
      { name: "Chana Dal" },
      { name: "Masoor Dal" },
    ],
    products: [
      {
        name: "Tata Sampann Unpolished Toor Dal",
        grandchild: "Toor Dal",
        brand: "Tata",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Premium unpolished toor dal, high protein",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 165 },
          { name: "2 kg", unitType: "KG", unitValue: 2, mrp: 310 },
        ],
      },
      {
        name: "Rajdhani Moong Dal",
        grandchild: "Moong Dal",
        brand: "Rajdhani",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Split green gram, washed and cleaned",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 150 },
        ],
      },
      {
        name: "Rajdhani Chana Dal",
        grandchild: "Chana Dal",
        brand: "Rajdhani",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Premium quality split Bengal gram",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 110 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 60 },
        ],
      },
      {
        name: "Tata Sampann Masoor Dal",
        grandchild: "Masoor Dal",
        brand: "Tata",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Unpolished masoor dal, cooks quickly",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 120 },
        ],
      },
    ],
  },

  "Dry Fruits & Nuts": {
    grandchildren: [
      { name: "Almonds" },
      { name: "Cashews" },
      { name: "Raisins" },
      { name: "Mixed Nuts" },
    ],
    products: [
      {
        name: "California Almonds",
        grandchild: "Almonds",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Premium California almonds, whole and natural",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 220 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 420 },
        ],
      },
      {
        name: "Goa Cashews W320",
        grandchild: "Cashews",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Whole cashews, grade W320, lightly salted",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 260 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 490 },
        ],
      },
      {
        name: "Green Raisins (Kishmish)",
        grandchild: "Raisins",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Seedless green raisins, naturally sweet",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 120 },
        ],
      },
      {
        name: "True Elements Mix Nuts & Seeds",
        grandchild: "Mixed Nuts",
        brand: "True Elements",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "COOL_DRY",
        description: "Roasted mix of almonds, cashews, pumpkin & sunflower seeds",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 299 },
        ],
      },
    ],
  },

  "Canned & Packaged": {
    grandchildren: [
      { name: "Canned Vegetables" },
      { name: "Pickles & Chutneys" },
      { name: "Jams & Spreads" },
      { name: "Ready Mixes" },
    ],
    products: [
      {
        name: "Del Monte Sweet Corn Kernels",
        grandchild: "Canned Vegetables",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Tender and sweet corn kernels in brine",
        variants: [
          { name: "420 g tin", unitType: "GRAM", unitValue: 420, mrp: 135 },
        ],
      },
      {
        name: "Mother's Recipe Mixed Pickle",
        grandchild: "Pickles & Chutneys",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Traditional Indian mixed vegetable pickle in mustard oil",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 95 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 140 },
        ],
      },
      {
        name: "Kissan Mixed Fruit Jam",
        grandchild: "Jams & Spreads",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Mixed fruit jam with real fruit pulp",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 75 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 160 },
        ],
      },
      {
        name: "MTR Rava Idli Mix",
        grandchild: "Ready Mixes",
        brand: "MTR",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Instant rava idli mix, ready in minutes",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 95 },
        ],
      },
    ],
  },

  "Sauces & Condiments": {
    grandchildren: [
      { name: "Ketchup" },
      { name: "Cooking Sauces" },
      { name: "Vinegar & Dressings" },
      { name: "Mayonnaise" },
    ],
    products: [
      {
        name: "Kissan Fresh Tomato Ketchup",
        grandchild: "Ketchup",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Made with 100% real tomatoes, tangy and sweet",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 52 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 110 },
        ],
      },
      {
        name: "Knorr Schezwan Sauce",
        grandchild: "Cooking Sauces",
        brand: "Knorr",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Spicy Indo-Chinese schezwan stir fry sauce",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 85 },
        ],
      },
      {
        name: "Borges White Wine Vinegar",
        grandchild: "Vinegar & Dressings",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "White wine vinegar for salads and marinades",
        variants: [
          { name: "250 ml", unitType: "ML", unitValue: 250, mrp: 145 },
        ],
      },
      {
        name: "Dr. Oetker FunFoods Veg Mayonnaise",
        grandchild: "Mayonnaise",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "REFRIGERATED",
        description: "Creamy eggless mayonnaise for sandwiches and dips",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 99 },
          { name: "400 g", unitType: "GRAM", unitValue: 400, mrp: 149 },
        ],
      },
    ],
  },

  Meat: {
    grandchildren: [
      { name: "Chicken" },
      { name: "Mutton" },
      { name: "Fish & Seafood" },
      { name: "Ready to Cook Meat" },
    ],
    products: [
      {
        name: "Fresh Chicken Breast",
        grandchild: "Chicken",
        foodType: "NON_VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Boneless skinless chicken breast, antibiotic free",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 220 },
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 410 },
        ],
      },
      {
        name: "Goat Curry Cut (Bone-In)",
        grandchild: "Mutton",
        foodType: "NON_VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Fresh goat meat curry cut with bone, cleaned",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 550 },
        ],
      },
      {
        name: "Rohu Fish Curry Cut",
        grandchild: "Fish & Seafood",
        foodType: "NON_VEG",
        productType: "FRESH_PRODUCE",
        storageType: "REFRIGERATED",
        description: "Fresh rohu fish, cleaned and cut into curry pieces",
        variants: [
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 180 },
        ],
      },
      {
        name: "ITC Master Chef Chicken Seekh Kebab",
        grandchild: "Ready to Cook Meat",
        brand: "ITC Master Chef",
        foodType: "NON_VEG",
        productType: "FROZEN",
        storageType: "FROZEN",
        description: "Ready to cook chicken seekh kebab, smoky flavour",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 250 },
        ],
      },
    ],
  },

  Eggs: {
    grandchildren: [
      { name: "Hen Eggs" },
      { name: "Free Range Eggs" },
      { name: "Organic Eggs" },
      { name: "Egg Products" },
    ],
    products: [
      {
        name: "White Hen Eggs",
        grandchild: "Hen Eggs",
        foodType: "EGG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Farm-fresh white eggs, standard size",
        variants: [
          { name: "6 pc", unitType: "PIECE", unitValue: 6, mrp: 48 },
          { name: "12 pc", unitType: "DOZEN", unitValue: 1, mrp: 90 },
          { name: "30 pc tray", unitType: "PIECE", unitValue: 30, mrp: 210 },
        ],
      },
      {
        name: "Free Range Brown Eggs",
        grandchild: "Free Range Eggs",
        foodType: "EGG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Cage-free brown eggs from free-range hens",
        variants: [
          { name: "6 pc", unitType: "PIECE", unitValue: 6, mrp: 72 },
        ],
      },
      {
        name: "Organic Country Eggs",
        grandchild: "Organic Eggs",
        foodType: "EGG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Certified organic eggs from countryside farms",
        variants: [
          { name: "6 pc", unitType: "PIECE", unitValue: 6, mrp: 85 },
        ],
      },
      {
        name: "Liquid Egg Whites",
        grandchild: "Egg Products",
        foodType: "EGG",
        productType: "DAIRY",
        storageType: "REFRIGERATED",
        description: "Pasteurized liquid egg whites, high protein",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 160 },
        ],
      },
    ],
  },

  "Ready to Eat": {
    grandchildren: [
      { name: "Instant Meals" },
      { name: "Ready Curries" },
      { name: "Cup Noodles" },
      { name: "Soups" },
    ],
    products: [
      {
        name: "MTR Ready to Eat Rajma Masala",
        grandchild: "Ready Curries",
        brand: "MTR",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Heat and eat rajma masala, authentic taste",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 99 },
        ],
      },
      {
        name: "Gits Ready Meals Dal Makhani",
        grandchild: "Instant Meals",
        brand: "Gits",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Creamy dal makhani, just heat and serve",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 95 },
        ],
      },
      {
        name: "Knorr Cup Noodles Mast Masala",
        grandchild: "Cup Noodles",
        brand: "Knorr",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Instant cup noodles, just add hot water",
        variants: [
          { name: "70 g", unitType: "GRAM", unitValue: 70, mrp: 45 },
        ],
      },
      {
        name: "Knorr Classic Tomato Soup",
        grandchild: "Soups",
        brand: "Knorr",
        foodType: "VEG",
        productType: "GROCERY",
        storageType: "AMBIENT",
        description: "Thick tomato soup mix with real tomatoes",
        variants: [
          { name: "53 g (serves 4)", unitType: "GRAM", unitValue: 53, mrp: 55 },
        ],
      },
    ],
  },

  "Tea & Coffee": {
    grandchildren: [
      { name: "Tea" },
      { name: "Green Tea" },
      { name: "Instant Coffee" },
      { name: "Filter Coffee" },
    ],
    products: [
      {
        name: "Tata Tea Gold",
        grandchild: "Tea",
        brand: "Tata Tea",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "COOL_DRY",
        description: "Premium leaf tea with 15% long leaves",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 150 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 290 },
        ],
      },
      {
        name: "Organic Tattva Green Tea",
        grandchild: "Green Tea",
        brand: "Organic Tattva",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "COOL_DRY",
        description: "Certified organic green tea leaves, rich in antioxidants",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 180 },
        ],
      },
      {
        name: "Nescafe Classic Instant Coffee",
        grandchild: "Instant Coffee",
        brand: "Nescafe",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "COOL_DRY",
        description: "100% pure instant coffee, rich aroma",
        variants: [
          { name: "50 g jar", unitType: "GRAM", unitValue: 50, mrp: 175 },
          { name: "200 g jar", unitType: "GRAM", unitValue: 200, mrp: 525 },
        ],
      },
      {
        name: "Bru Filter Coffee",
        grandchild: "Filter Coffee",
        brand: "Bru",
        foodType: "VEG",
        productType: "BEVERAGES",
        storageType: "COOL_DRY",
        description: "South Indian filter coffee blend, 60:40 coffee-chicory",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 195 },
          { name: "500 g", unitType: "GRAM", unitValue: 500, mrp: 450 },
        ],
      },
    ],
  },

  "Chocolates & Sweets": {
    grandchildren: [
      { name: "Chocolates" },
      { name: "Toffees & Candies" },
      { name: "Traditional Sweets" },
      { name: "Gifting Packs" },
    ],
    products: [
      {
        name: "Cadbury Dairy Milk Silk",
        grandchild: "Chocolates",
        brand: "Cadbury",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "COOL_DRY",
        description: "Smooth and silky milk chocolate bar",
        variants: [
          { name: "60 g", unitType: "GRAM", unitValue: 60, mrp: 80 },
          { name: "150 g", unitType: "GRAM", unitValue: 150, mrp: 180 },
        ],
      },
      {
        name: "Parle Kismi Toffee",
        grandchild: "Toffees & Candies",
        brand: "Parle",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Classic elaichi flavoured caramel toffee",
        variants: [
          { name: "277 g (50 pc)", unitType: "GRAM", unitValue: 277, mrp: 80 },
        ],
      },
      {
        name: "Haldiram's Gulab Jamun Tin",
        grandchild: "Traditional Sweets",
        brand: "Haldiram's",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "AMBIENT",
        description: "Ready to eat gulab jamun in sugar syrup",
        variants: [
          { name: "1 kg tin", unitType: "KG", unitValue: 1, mrp: 220 },
        ],
      },
      {
        name: "Ferrero Rocher Gift Box",
        grandchild: "Gifting Packs",
        brand: "Ferrero Rocher",
        foodType: "VEG",
        productType: "SNACKS",
        storageType: "COOL_DRY",
        description: "Premium hazelnut chocolate gift box",
        variants: [
          { name: "16 pc box", unitType: "PIECE", unitValue: 16, mrp: 549 },
          { name: "24 pc box", unitType: "PIECE", unitValue: 24, mrp: 799 },
        ],
      },
    ],
  },
};

// ==================== PERSONAL CARE ====================
const PERSONAL_CARE: Record<string, SubcategoryData> = {
  "Face Wash": {
    grandchildren: [
      { name: "Gel Face Wash" },
      { name: "Cream Face Wash" },
      { name: "Foam Face Wash" },
      { name: "Scrub Face Wash" },
    ],
    products: [
      {
        name: "Himalaya Neem Face Wash",
        grandchild: "Gel Face Wash",
        brand: "Himalaya",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Soap-free herbal face wash with neem and turmeric",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 140 },
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 250 },
        ],
      },
      {
        name: "Mamaearth Tea Tree Face Wash",
        grandchild: "Foam Face Wash",
        brand: "Mamaearth",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Anti-acne face wash with tea tree and neem",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 249 },
        ],
      },
      {
        name: "Nivea Milk Delights Face Wash",
        grandchild: "Cream Face Wash",
        brand: "Nivea",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Moisturizing face wash with honey",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 165 },
        ],
      },
      {
        name: "Himalaya Walnut Scrub",
        grandchild: "Scrub Face Wash",
        brand: "Himalaya",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Gentle exfoliating face scrub with walnut shell powder",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 155 },
        ],
      },
    ],
  },

  Shampoo: {
    grandchildren: [
      { name: "Anti-Dandruff" },
      { name: "Smoothening" },
      { name: "Volumizing" },
      { name: "Herbal" },
    ],
    products: [
      {
        name: "Head & Shoulders Anti-Dandruff Shampoo",
        grandchild: "Anti-Dandruff",
        brand: "Head & Shoulders",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Up to 100% dandruff free, smooth and silky hair",
        variants: [
          { name: "180 ml", unitType: "ML", unitValue: 180, mrp: 200 },
          { name: "340 ml", unitType: "ML", unitValue: 340, mrp: 365 },
        ],
      },
      {
        name: "Sunsilk Lusciously Thick & Long Shampoo",
        grandchild: "Volumizing",
        brand: "Sunsilk",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Thickening shampoo with keratin yoghurt",
        variants: [
          { name: "180 ml", unitType: "ML", unitValue: 180, mrp: 135 },
        ],
      },
      {
        name: "Pantene Smooth & Silky Shampoo",
        grandchild: "Smoothening",
        brand: "Pantene",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Pro-V formula for frizz-free silky smooth hair",
        variants: [
          { name: "180 ml", unitType: "ML", unitValue: 180, mrp: 170 },
          { name: "340 ml", unitType: "ML", unitValue: 340, mrp: 310 },
        ],
      },
      {
        name: "Dabur Vatika Henna & Olive Shampoo",
        grandchild: "Herbal",
        brand: "Dabur",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Natural shampoo with henna and olive for strong hair",
        variants: [
          { name: "180 ml", unitType: "ML", unitValue: 180, mrp: 130 },
          { name: "340 ml", unitType: "ML", unitValue: 340, mrp: 240 },
        ],
      },
    ],
  },

  Soap: {
    grandchildren: [
      { name: "Beauty Soap" },
      { name: "Antibacterial Soap" },
      { name: "Herbal Soap" },
      { name: "Moisturizing Soap" },
    ],
    products: [
      {
        name: "Lux Soft Touch Bar Soap",
        grandchild: "Beauty Soap",
        brand: "Lux",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "French rose and almond oil beauty soap",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 42 },
          { name: "150 g", unitType: "GRAM", unitValue: 150, mrp: 58 },
        ],
      },
      {
        name: "Dettol Original Bar Soap",
        grandchild: "Antibacterial Soap",
        brand: "Dettol",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Trusted protection against 100 illness-causing germs",
        variants: [
          { name: "75 g", unitType: "GRAM", unitValue: 75, mrp: 38 },
          { name: "125 g", unitType: "GRAM", unitValue: 125, mrp: 55 },
        ],
      },
      {
        name: "Medimix Classic Ayurvedic Soap",
        grandchild: "Herbal Soap",
        brand: "Medimix",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "18-herb ayurvedic soap for clear skin",
        variants: [
          { name: "125 g", unitType: "GRAM", unitValue: 125, mrp: 46 },
        ],
      },
      {
        name: "Dove Cream Beauty Bar",
        grandchild: "Moisturizing Soap",
        brand: "Dove",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "1/4 moisturizing cream for soft, smooth skin",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 56 },
          { name: "100 g × 3 pack", unitType: "PACK", unitValue: 3, mrp: 155, packType: "Value Pack" },
        ],
      },
    ],
  },

  Skincare: {
    grandchildren: [
      { name: "Moisturizers" },
      { name: "Sunscreen" },
      { name: "Face Cream" },
      { name: "Body Lotion" },
    ],
    products: [
      {
        name: "Nivea Soft Moisturizing Cream",
        grandchild: "Moisturizers",
        brand: "Nivea",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Refreshingly soft moisturizing cream with Vitamin E",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 195 },
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 345 },
        ],
      },
      {
        name: "Mamaearth Ultra Light Sunscreen SPF 50",
        grandchild: "Sunscreen",
        brand: "Mamaearth",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Ultra-light Indian sunscreen, no white cast",
        variants: [
          { name: "80 g", unitType: "GRAM", unitValue: 80, mrp: 499 },
        ],
      },
      {
        name: "Himalaya Nourishing Skin Cream",
        grandchild: "Face Cream",
        brand: "Himalaya",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Winter cherry and aloe vera nourishing cream",
        variants: [
          { name: "50 ml", unitType: "ML", unitValue: 50, mrp: 95 },
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 165 },
        ],
      },
      {
        name: "Nivea Nourishing Body Milk",
        grandchild: "Body Lotion",
        brand: "Nivea",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Deep moisture body lotion for very dry skin",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 230 },
          { name: "400 ml", unitType: "ML", unitValue: 400, mrp: 420 },
        ],
      },
    ],
  },

  Haircare: {
    grandchildren: [
      { name: "Hair Oil" },
      { name: "Conditioner" },
      { name: "Hair Serum" },
      { name: "Hair Color" },
    ],
    products: [
      {
        name: "Parachute Advansed Coconut Hair Oil",
        grandchild: "Hair Oil",
        brand: "Parachute",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "100% pure coconut hair oil for strong hair",
        variants: [
          { name: "300 ml", unitType: "ML", unitValue: 300, mrp: 175 },
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 265 },
        ],
      },
      {
        name: "Pantene Pro-V Conditioner Silky Smooth",
        grandchild: "Conditioner",
        brand: "Pantene",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Deep conditioning for frizz-free hair",
        variants: [
          { name: "180 ml", unitType: "ML", unitValue: 180, mrp: 170 },
        ],
      },
      {
        name: "Mamaearth Onion Hair Serum",
        grandchild: "Hair Serum",
        brand: "Mamaearth",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Onion oil serum for frizz-free and shiny hair",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 399 },
        ],
      },
      {
        name: "Dabur Vatika Henna Hair Color",
        grandchild: "Hair Color",
        brand: "Dabur",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Natural black hair colour with henna",
        variants: [
          { name: "60 g", unitType: "GRAM", unitValue: 60, mrp: 50 },
        ],
      },
    ],
  },

  "Oral Care": {
    grandchildren: [
      { name: "Toothpaste" },
      { name: "Toothbrush" },
      { name: "Mouthwash" },
      { name: "Dental Floss" },
    ],
    products: [
      {
        name: "Colgate Strong Teeth Toothpaste",
        grandchild: "Toothpaste",
        brand: "Colgate",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "India's No.1 toothpaste with calcium boost",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 62 },
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 108 },
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 155 },
        ],
      },
      {
        name: "Colgate Slim Soft Toothbrush",
        grandchild: "Toothbrush",
        brand: "Colgate",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Ultra-soft slim tip bristles for gentle cleaning",
        variants: [
          { name: "1 pc", unitType: "PIECE", unitValue: 1, mrp: 65 },
          { name: "4 pc pack", unitType: "PACK", unitValue: 4, mrp: 220, packType: "Family Pack" },
        ],
      },
      {
        name: "Closeup Eucalyptus Mint Mouthwash",
        grandchild: "Mouthwash",
        brand: "Closeup",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "12-hour fresh breath with antibacterial protection",
        variants: [
          { name: "250 ml", unitType: "ML", unitValue: 250, mrp: 110 },
        ],
      },
      {
        name: "Sensodyne Dental Floss",
        grandchild: "Dental Floss",
        brand: "Sensodyne",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Gentle dental floss for sensitive teeth",
        variants: [
          { name: "50 m", unitType: "PIECE", unitValue: 1, mrp: 195 },
        ],
      },
    ],
  },

  Deodorant: {
    grandchildren: [
      { name: "Roll-On" },
      { name: "Body Spray" },
      { name: "Stick Deodorant" },
      { name: "Natural Deodorant" },
    ],
    products: [
      {
        name: "Nivea Fresh Active Roll On",
        grandchild: "Roll-On",
        brand: "Nivea",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "48h freshness, ocean extracts",
        variants: [
          { name: "50 ml", unitType: "ML", unitValue: 50, mrp: 199 },
        ],
      },
      {
        name: "Dove Men+Care Deodorant Spray",
        grandchild: "Body Spray",
        brand: "Dove",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "48h protection with 1/4 moisturizing technology",
        variants: [
          { name: "150 ml", unitType: "ML", unitValue: 150, mrp: 260 },
        ],
      },
      {
        name: "Nivea Men Deep Impact Stick",
        grandchild: "Stick Deodorant",
        brand: "Nivea",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Solid stick deodorant, 48h dry protection",
        variants: [
          { name: "15 g", unitType: "GRAM", unitValue: 15, mrp: 195 },
        ],
      },
      {
        name: "Mamaearth Underarm Roll On",
        grandchild: "Natural Deodorant",
        brand: "Mamaearth",
        productType: "PERSONAL_CARE",
        storageType: "AMBIENT",
        description: "Natural deodorant with lemon and eucalyptus",
        variants: [
          { name: "50 ml", unitType: "ML", unitValue: 50, mrp: 199 },
        ],
      },
    ],
  },
};

// ==================== HOUSEHOLD ====================
const HOUSEHOLD: Record<string, SubcategoryData> = {
  "Floor Cleaner": {
    grandchildren: [
      { name: "Disinfectant Cleaner" },
      { name: "Surface Cleaner" },
      { name: "Tile Cleaner" },
      { name: "Mop & Refills" },
    ],
    products: [
      {
        name: "Lizol Disinfectant Surface Cleaner Citrus",
        grandchild: "Disinfectant Cleaner",
        brand: "Lizol",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Kills 99.9% germs, fresh citrus fragrance",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 115 },
          { name: "975 ml", unitType: "ML", unitValue: 975, mrp: 210 },
        ],
      },
      {
        name: "Domex Fresh Guard Ocean",
        grandchild: "Surface Cleaner",
        brand: "Domex",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Multi-surface disinfectant with ocean fragrance",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 99 },
        ],
      },
      {
        name: "Harpic Bathroom Cleaner Lemon",
        grandchild: "Tile Cleaner",
        brand: "Harpic",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Tough stain remover for bathroom tiles and fittings",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 130 },
        ],
      },
      {
        name: "Scotch-Brite Flat Mop Refill",
        grandchild: "Mop & Refills",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Microfiber flat mop refill pad, machine washable",
        variants: [
          { name: "1 pc", unitType: "PIECE", unitValue: 1, mrp: 299 },
        ],
      },
    ],
  },

  Detergent: {
    grandchildren: [
      { name: "Washing Powder" },
      { name: "Liquid Detergent" },
      { name: "Detergent Bar" },
      { name: "Fabric Softener" },
    ],
    products: [
      {
        name: "Surf Excel Easy Wash Powder",
        grandchild: "Washing Powder",
        brand: "Surf Excel",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Removes tough stains in just one wash",
        variants: [
          { name: "1 kg", unitType: "KG", unitValue: 1, mrp: 110 },
          { name: "4 kg", unitType: "KG", unitValue: 4, mrp: 400 },
        ],
      },
      {
        name: "Ariel Matic Liquid Detergent",
        grandchild: "Liquid Detergent",
        brand: "Ariel",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "For top-load washing machines, removes tough stains",
        variants: [
          { name: "1 L", unitType: "LITER", unitValue: 1, mrp: 245 },
          { name: "2 L", unitType: "LITER", unitValue: 2, mrp: 440 },
        ],
      },
      {
        name: "Rin Detergent Bar",
        grandchild: "Detergent Bar",
        brand: "Rin",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Bright white clothes in every wash",
        variants: [
          { name: "250 g", unitType: "GRAM", unitValue: 250, mrp: 28 },
        ],
      },
      {
        name: "Comfort After Wash Lily Fresh",
        grandchild: "Fabric Softener",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Fabric conditioner for soft and fragrant clothes",
        variants: [
          { name: "220 ml", unitType: "ML", unitValue: 220, mrp: 65 },
          { name: "860 ml", unitType: "ML", unitValue: 860, mrp: 190 },
        ],
      },
    ],
  },

  Dishwash: {
    grandchildren: [
      { name: "Dishwash Liquid" },
      { name: "Dishwash Bar" },
      { name: "Dishwash Gel" },
      { name: "Scrub Pads" },
    ],
    products: [
      {
        name: "Vim Dishwash Liquid Gel Lemon",
        grandchild: "Dishwash Liquid",
        brand: "Vim",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "2x better grease cutting, lemon fragrance",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 99 },
          { name: "750 ml", unitType: "ML", unitValue: 750, mrp: 135 },
        ],
      },
      {
        name: "Vim Dishwash Bar",
        grandchild: "Dishwash Bar",
        brand: "Vim",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Power of lemon for sparkling clean utensils",
        variants: [
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 20 },
          { name: "600 g", unitType: "GRAM", unitValue: 600, mrp: 52 },
        ],
      },
      {
        name: "Vim Anti Smell Gel",
        grandchild: "Dishwash Gel",
        brand: "Vim",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Removes tough food smells from utensils",
        variants: [
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 120 },
        ],
      },
      {
        name: "Scotch-Brite Green Scrub Pad",
        grandchild: "Scrub Pads",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Long-lasting scrub pad for daily dishwashing",
        variants: [
          { name: "3 pc pack", unitType: "PACK", unitValue: 3, mrp: 40 },
        ],
      },
    ],
  },

  "Kitchen Supplies": {
    grandchildren: [
      { name: "Aluminium Foil" },
      { name: "Cling Wrap" },
      { name: "Garbage Bags" },
      { name: "Kitchen Towels" },
    ],
    products: [
      {
        name: "Freshwrapp Aluminium Foil",
        grandchild: "Aluminium Foil",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Food-grade aluminium foil for cooking and wrapping",
        variants: [
          { name: "9 m roll", unitType: "PIECE", unitValue: 1, mrp: 80 },
          { name: "25 m roll", unitType: "PIECE", unitValue: 1, mrp: 185 },
        ],
      },
      {
        name: "Freshwrapp Cling Film",
        grandchild: "Cling Wrap",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "BPA-free food wrap, keeps food fresh",
        variants: [
          { name: "30 m roll", unitType: "PIECE", unitValue: 1, mrp: 95 },
        ],
      },
      {
        name: "Ezee Garbage Bags Medium",
        grandchild: "Garbage Bags",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Leak-proof garbage bags, medium size",
        variants: [
          { name: "30 pc (19x21)", unitType: "PACK", unitValue: 30, mrp: 85 },
        ],
      },
      {
        name: "Scott Kitchen Towel Roll",
        grandchild: "Kitchen Towels",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Absorbent paper towel roll for kitchen use",
        variants: [
          { name: "1 roll", unitType: "PIECE", unitValue: 1, mrp: 79 },
          { name: "2 roll pack", unitType: "PACK", unitValue: 2, mrp: 149 },
        ],
      },
    ],
  },

  "Insect Repellent": {
    grandchildren: [
      { name: "Electric Mosquito Repellent" },
      { name: "Coils" },
      { name: "Spray" },
      { name: "Liquid Refills" },
    ],
    products: [
      {
        name: "All Out Ultra Mosquito Repellent Refill",
        grandchild: "Liquid Refills",
        brand: "All Out",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "45 ml refill, 60 nights protection",
        variants: [
          { name: "45 ml refill", unitType: "ML", unitValue: 45, mrp: 79 },
          { name: "45 ml × 2 pack", unitType: "PACK", unitValue: 2, mrp: 145, packType: "Value Pack" },
        ],
      },
      {
        name: "Good Knight Power Activ+",
        grandchild: "Electric Mosquito Repellent",
        brand: "Good Knight",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Plug-in liquid mosquito repellent machine + refill",
        variants: [
          { name: "Machine + 45 ml refill", unitType: "PIECE", unitValue: 1, mrp: 95 },
        ],
      },
      {
        name: "Mortein Mosquito Coil",
        grandchild: "Coils",
        brand: "Mortein",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Green mosquito coil, 8h protection per coil",
        variants: [
          { name: "10 pc pack", unitType: "PACK", unitValue: 10, mrp: 65 },
        ],
      },
      {
        name: "Mortein Rapid Action Spray",
        grandchild: "Spray",
        brand: "Mortein",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Fast knock-down spray for cockroaches and mosquitoes",
        variants: [
          { name: "425 ml", unitType: "ML", unitValue: 425, mrp: 220 },
        ],
      },
    ],
  },

  "Air Freshener": {
    grandchildren: [
      { name: "Room Spray" },
      { name: "Gel Air Freshener" },
      { name: "Car Freshener" },
      { name: "Dhoop & Agarbatti" },
    ],
    products: [
      {
        name: "Odonil Room Air Freshener Spray Lavender",
        grandchild: "Room Spray",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Long-lasting room spray with lavender fragrance",
        variants: [
          { name: "240 ml", unitType: "ML", unitValue: 240, mrp: 150 },
        ],
      },
      {
        name: "Odonil Gel Pocket Jasmine",
        grandchild: "Gel Air Freshener",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Small gel freshener for bathrooms and cupboards",
        variants: [
          { name: "75 g", unitType: "GRAM", unitValue: 75, mrp: 55 },
          { name: "75 g × 3 pack", unitType: "PACK", unitValue: 3, mrp: 149 },
        ],
      },
      {
        name: "Ambi Pur Car Freshener Lavender",
        grandchild: "Car Freshener",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Clip-on car air freshener, lasts up to 45 days",
        variants: [
          { name: "7.5 ml", unitType: "ML", unitValue: 7.5, mrp: 320 },
        ],
      },
      {
        name: "Cycle Pure Agarbatti",
        grandchild: "Dhoop & Agarbatti",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Traditional incense sticks, natural fragrance",
        variants: [
          { name: "120 sticks", unitType: "PACK", unitValue: 1, mrp: 65 },
        ],
      },
    ],
  },

  "Garbage Bags": {
    grandchildren: [
      { name: "Small Bags" },
      { name: "Medium Bags" },
      { name: "Large Bags" },
      { name: "Biodegradable Bags" },
    ],
    products: [
      {
        name: "Ezee Bio-degradable Garbage Bags Small",
        grandchild: "Small Bags",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Eco-friendly small garbage bags 17×19 inches",
        variants: [
          { name: "30 pc", unitType: "PACK", unitValue: 30, mrp: 75 },
        ],
      },
      {
        name: "Ezee Garbage Bags Medium Black",
        grandchild: "Medium Bags",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Leak-proof medium garbage bags 19×21 inches",
        variants: [
          { name: "30 pc", unitType: "PACK", unitValue: 30, mrp: 85 },
          { name: "15 pc", unitType: "PACK", unitValue: 15, mrp: 49 },
        ],
      },
      {
        name: "Ezee Garbage Bags Large",
        grandchild: "Large Bags",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "Heavy-duty large garbage bags 24×32 inches",
        variants: [
          { name: "15 pc", unitType: "PACK", unitValue: 15, mrp: 95 },
        ],
      },
      {
        name: "BeyondGreen Compostable Bags",
        grandchild: "Biodegradable Bags",
        productType: "HOUSEHOLD",
        storageType: "AMBIENT",
        description: "100% compostable garbage bags, eco-friendly",
        variants: [
          { name: "15 pc", unitType: "PACK", unitValue: 15, mrp: 149 },
        ],
      },
    ],
  },
};

// ==================== BABY CARE ====================
const BABY_CARE: Record<string, SubcategoryData> = {
  Diapers: {
    grandchildren: [
      { name: "Tape Diapers" },
      { name: "Pant Diapers" },
      { name: "Newborn Diapers" },
      { name: "Diaper Wipes" },
    ],
    products: [
      {
        name: "Pampers Premium Care Pants M",
        grandchild: "Pant Diapers",
        brand: "Pampers",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "360-degree cottony softness with Aloe Vera",
        variants: [
          { name: "38 pc (M 7-12 kg)", unitType: "PACK", unitValue: 38, mrp: 899 },
          { name: "76 pc (M 7-12 kg)", unitType: "PACK", unitValue: 76, mrp: 1649, packType: "Super Value" },
        ],
      },
      {
        name: "Huggies Wonder Pants L",
        grandchild: "Pant Diapers",
        brand: "Huggies",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Bubble bed technology for rash-free comfort",
        variants: [
          { name: "42 pc (L 9-14 kg)", unitType: "PACK", unitValue: 42, mrp: 849 },
        ],
      },
      {
        name: "Pampers Active Baby Tape NB",
        grandchild: "Newborn Diapers",
        brand: "Pampers",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Gentle tape diapers for newborns, up to 5 kg",
        variants: [
          { name: "24 pc (NB)", unitType: "PACK", unitValue: 24, mrp: 399 },
        ],
      },
      {
        name: "Johnson's Baby Wipes Gentle Cleansing",
        grandchild: "Diaper Wipes",
        brand: "Johnson's Baby",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Alcohol-free, paraben-free gentle baby wipes",
        variants: [
          { name: "72 wipes", unitType: "PACK", unitValue: 72, mrp: 220 },
        ],
      },
    ],
  },

  "Baby Food": {
    grandchildren: [
      { name: "Cereal" },
      { name: "Puree" },
      { name: "Formula Milk" },
      { name: "Baby Snacks" },
    ],
    products: [
      {
        name: "Cerelac Wheat Apple",
        grandchild: "Cereal",
        brand: "Cerelac",
        foodType: "VEG",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Stage 2 baby cereal (8 months+), iron fortified",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 260 },
        ],
      },
      {
        name: "Nestle Cerelac Rice Vegetable",
        grandchild: "Puree",
        brand: "Nestle",
        foodType: "VEG",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Stage 1 rice and vegetable blend (6 months+)",
        variants: [
          { name: "300 g", unitType: "GRAM", unitValue: 300, mrp: 250 },
        ],
      },
      {
        name: "Nestle Lactogen 1 Infant Formula",
        grandchild: "Formula Milk",
        brand: "Nestle",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Spray-dried infant formula (0-6 months)",
        variants: [
          { name: "400 g", unitType: "GRAM", unitValue: 400, mrp: 460 },
        ],
      },
      {
        name: "Cerelac Nutri Puffs Banana & Orange",
        grandchild: "Baby Snacks",
        brand: "Cerelac",
        foodType: "VEG",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Finger food puffs for babies 12 months+",
        variants: [
          { name: "25 g", unitType: "GRAM", unitValue: 25, mrp: 99 },
        ],
      },
    ],
  },

  "Baby Skincare": {
    grandchildren: [
      { name: "Baby Lotion" },
      { name: "Baby Oil" },
      { name: "Baby Soap & Wash" },
      { name: "Diaper Rash Cream" },
    ],
    products: [
      {
        name: "Johnson's Baby Milk + Rice Lotion",
        grandchild: "Baby Lotion",
        brand: "Johnson's Baby",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "24-hour moisture, clinically proven mild",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 255 },
        ],
      },
      {
        name: "Johnson's Baby Oil",
        grandchild: "Baby Oil",
        brand: "Johnson's Baby",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Pure mineral oil for baby massage",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 210 },
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 430 },
        ],
      },
      {
        name: "Himalaya Gentle Baby Wash",
        grandchild: "Baby Soap & Wash",
        brand: "Himalaya",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Tear-free gentle head-to-toe baby wash",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 175 },
          { name: "400 ml", unitType: "ML", unitValue: 400, mrp: 320 },
        ],
      },
      {
        name: "Himalaya Diaper Rash Cream",
        grandchild: "Diaper Rash Cream",
        brand: "Himalaya",
        productType: "BABY_CARE",
        storageType: "AMBIENT",
        description: "Soothes and prevents diaper rash with aloe vera",
        variants: [
          { name: "50 g", unitType: "GRAM", unitValue: 50, mrp: 125 },
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 215 },
        ],
      },
    ],
  },
};

// ==================== OTC PHARMA ====================
const OTC_PHARMA: Record<string, SubcategoryData> = {
  "Pain Relief": {
    grandchildren: [
      { name: "Headache & Fever" },
      { name: "Body Pain" },
      { name: "Joint Pain" },
      { name: "Pain Balm" },
    ],
    products: [
      {
        name: "Crocin Advance Paracetamol 500mg",
        grandchild: "Headache & Fever",
        brand: "Crocin",
        productType: "OTC_PHARMA",
        storageType: "COOL_DRY",
        description: "Fast relief from headache, toothache and fever",
        variants: [
          { name: "15 tablets", unitType: "PACK", unitValue: 15, mrp: 33 },
        ],
      },
      {
        name: "Moov Pain Relief Spray",
        grandchild: "Body Pain",
        brand: "Moov",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Fast action spray for back pain and muscle pain",
        variants: [
          { name: "35 g", unitType: "GRAM", unitValue: 35, mrp: 115 },
          { name: "80 g", unitType: "GRAM", unitValue: 80, mrp: 240 },
        ],
      },
      {
        name: "Zandu Balm Ultra Power",
        grandchild: "Pain Balm",
        brand: "Zandu",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Strong herbal pain balm for headache and cold",
        variants: [
          { name: "8 ml", unitType: "ML", unitValue: 8, mrp: 45 },
          { name: "25 ml", unitType: "ML", unitValue: 25, mrp: 125 },
        ],
      },
      {
        name: "Moov Strong Diclofenac Gel",
        grandchild: "Joint Pain",
        brand: "Moov",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Topical gel for joint and knee pain relief",
        variants: [
          { name: "30 g", unitType: "GRAM", unitValue: 30, mrp: 95 },
        ],
      },
    ],
  },

  "Cold & Cough": {
    grandchildren: [
      { name: "Cough Syrup" },
      { name: "Lozenges" },
      { name: "Nasal Spray" },
      { name: "Vapour Rub" },
    ],
    products: [
      {
        name: "Dabur Honitus Cough Syrup",
        grandchild: "Cough Syrup",
        brand: "Dabur",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Ayurvedic cough syrup with honey and tulsi",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 85 },
        ],
      },
      {
        name: "Vicks Cough Drops Ginger",
        grandchild: "Lozenges",
        brand: "Vicks",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Throat soothing cough drops with ginger flavour",
        variants: [
          { name: "20 pc pack", unitType: "PACK", unitValue: 20, mrp: 50 },
        ],
      },
      {
        name: "Otrivin Nasal Spray",
        grandchild: "Nasal Spray",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Fast relief from nasal congestion, up to 12h",
        variants: [
          { name: "10 ml", unitType: "ML", unitValue: 10, mrp: 80 },
        ],
      },
      {
        name: "Vicks VapoRub",
        grandchild: "Vapour Rub",
        brand: "Vicks",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Topical ointment for cold, cough and congestion",
        variants: [
          { name: "25 ml", unitType: "ML", unitValue: 25, mrp: 75 },
          { name: "50 ml", unitType: "ML", unitValue: 50, mrp: 130 },
        ],
      },
    ],
  },

  Digestive: {
    grandchildren: [
      { name: "Antacids" },
      { name: "Digestive Supplements" },
      { name: "Laxatives" },
      { name: "Churan & Powder" },
    ],
    products: [
      {
        name: "Eno Fruit Salt Lemon",
        grandchild: "Antacids",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Fast relief from acidity and gas in 6 seconds",
        variants: [
          { name: "5 g × 6 sachets", unitType: "PACK", unitValue: 6, mrp: 42 },
          { name: "100 g bottle", unitType: "GRAM", unitValue: 100, mrp: 95 },
        ],
      },
      {
        name: "Dabur Hajmola Regular",
        grandchild: "Digestive Supplements",
        brand: "Dabur",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Tasty digestive tablets for gas and indigestion",
        variants: [
          { name: "120 tablets bottle", unitType: "PACK", unitValue: 120, mrp: 65 },
        ],
      },
      {
        name: "Isabgol Psyllium Husk",
        grandchild: "Laxatives",
        productType: "OTC_PHARMA",
        storageType: "COOL_DRY",
        description: "Natural fibre laxative, gentle stomach cleanser",
        variants: [
          { name: "100 g", unitType: "GRAM", unitValue: 100, mrp: 80 },
          { name: "200 g", unitType: "GRAM", unitValue: 200, mrp: 145 },
        ],
      },
      {
        name: "Zandu Pancharishta Digestive Tonic",
        grandchild: "Churan & Powder",
        brand: "Zandu",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Ayurvedic digestive tonic for indigestion and gas",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 99 },
          { name: "450 ml", unitType: "ML", unitValue: 450, mrp: 195 },
        ],
      },
    ],
  },

  Antiseptic: {
    grandchildren: [
      { name: "Antiseptic Liquid" },
      { name: "Antiseptic Cream" },
      { name: "Bandages" },
      { name: "Hand Sanitizer" },
    ],
    products: [
      {
        name: "Dettol Antiseptic Liquid",
        grandchild: "Antiseptic Liquid",
        brand: "Dettol",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Trusted antiseptic for first aid and hygiene",
        variants: [
          { name: "125 ml", unitType: "ML", unitValue: 125, mrp: 65 },
          { name: "500 ml", unitType: "ML", unitValue: 500, mrp: 220 },
        ],
      },
      {
        name: "Dettol Antiseptic Cream",
        grandchild: "Antiseptic Cream",
        brand: "Dettol",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Antiseptic cream for cuts, bites and stings",
        variants: [
          { name: "30 g", unitType: "GRAM", unitValue: 30, mrp: 65 },
        ],
      },
      {
        name: "Band-Aid Flexible Fabric Strips",
        grandchild: "Bandages",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Flexible fabric adhesive bandages with pad",
        variants: [
          { name: "100 strips", unitType: "PACK", unitValue: 100, mrp: 250 },
        ],
      },
      {
        name: "Lifebuoy Hand Sanitizer Total 10",
        grandchild: "Hand Sanitizer",
        brand: "Lifebuoy",
        productType: "OTC_PHARMA",
        storageType: "AMBIENT",
        description: "Kills 99.9% germs, lemon fresh fragrance",
        variants: [
          { name: "50 ml", unitType: "ML", unitValue: 50, mrp: 35 },
          { name: "500 ml pump", unitType: "ML", unitValue: 500, mrp: 199 },
        ],
      },
    ],
  },
};

// ==================== PET CARE ====================
const PET_CARE: Record<string, SubcategoryData> = {
  "Pet Food": {
    grandchildren: [
      { name: "Dog Food" },
      { name: "Cat Food" },
      { name: "Dog Treats" },
      { name: "Cat Treats" },
    ],
    products: [
      {
        name: "Pedigree Adult Chicken & Vegetables",
        grandchild: "Dog Food",
        brand: "Pedigree",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Complete nutrition for adult dogs, chicken & veg flavour",
        variants: [
          { name: "3 kg", unitType: "KG", unitValue: 3, mrp: 560 },
          { name: "10 kg", unitType: "KG", unitValue: 10, mrp: 1650 },
        ],
      },
      {
        name: "Whiskas Adult Ocean Fish",
        grandchild: "Cat Food",
        brand: "Whiskas",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Complete cat food with ocean fish, balanced nutrition",
        variants: [
          { name: "1.2 kg", unitType: "KG", unitValue: 1.2, mrp: 420 },
          { name: "3 kg", unitType: "KG", unitValue: 3, mrp: 950 },
        ],
      },
      {
        name: "Pedigree Dentastix Medium Dogs",
        grandchild: "Dog Treats",
        brand: "Pedigree",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Daily dental chew for medium dogs, reduces tartar",
        variants: [
          { name: "7 sticks", unitType: "PACK", unitValue: 7, mrp: 220 },
        ],
      },
      {
        name: "Whiskas Temptations Salmon Treats",
        grandchild: "Cat Treats",
        brand: "Whiskas",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Crunchy outside, soft inside salmon flavour cat treats",
        variants: [
          { name: "75 g", unitType: "GRAM", unitValue: 75, mrp: 120 },
        ],
      },
    ],
  },

  "Pet Hygiene": {
    grandchildren: [
      { name: "Pet Shampoo" },
      { name: "Tick & Flea Treatment" },
      { name: "Pet Wipes" },
      { name: "Litter & Pads" },
    ],
    products: [
      {
        name: "Drools Anti-Tick Dog Shampoo",
        grandchild: "Pet Shampoo",
        brand: "Drools",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Neem-based anti-tick and flea dog shampoo",
        variants: [
          { name: "200 ml", unitType: "ML", unitValue: 200, mrp: 195 },
        ],
      },
      {
        name: "Himalaya Erina Tick & Flea Spray",
        grandchild: "Tick & Flea Treatment",
        brand: "Himalaya",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Herbal spray for tick and flea control",
        variants: [
          { name: "100 ml", unitType: "ML", unitValue: 100, mrp: 180 },
        ],
      },
      {
        name: "Pedigree Pet Grooming Wipes",
        grandchild: "Pet Wipes",
        brand: "Pedigree",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Gentle cleansing wipes for dogs, fresh scent",
        variants: [
          { name: "50 wipes", unitType: "PACK", unitValue: 50, mrp: 250 },
        ],
      },
      {
        name: "Drools Cat Litter Clumping",
        grandchild: "Litter & Pads",
        brand: "Drools",
        productType: "PET_CARE",
        storageType: "AMBIENT",
        description: "Bentonite clumping cat litter, low dust",
        variants: [
          { name: "5 kg", unitType: "KG", unitValue: 5, mrp: 430 },
        ],
      },
    ],
  },
};

// ==================== MAIN ====================

const ALL_CATEGORIES: Record<string, Record<string, SubcategoryData>> = {
  Food: FOOD,
  "Personal Care": PERSONAL_CARE,
  Household: HOUSEHOLD,
  "Baby Care": BABY_CARE,
  "OTC Pharma": OTC_PHARMA,
  "Pet Care": PET_CARE,
};

let skuCounter = 10000;
function nextSku() {
  return `MRT-${++skuCounter}`;
}

async function main() {
  // Load categories and brands
  const allCats = await prisma.category.findMany();
  const allBrands = await prisma.brand.findMany();

  const catByName = new Map(allCats.map((c) => [c.name, c]));
  const brandByName = new Map(allBrands.map((b) => [b.name, b]));

  let totalProducts = 0;
  let totalVariants = 0;
  let totalGrandchildren = 0;

  for (const [rootName, subcategories] of Object.entries(ALL_CATEGORIES)) {
    const rootCat = catByName.get(rootName);
    if (!rootCat) {
      console.error(`Root category "${rootName}" not found, skipping`);
      continue;
    }
    console.log(`\n=== ${rootName} ===`);

    for (const [subName, data] of Object.entries(subcategories)) {
      // Find subcategory (child of root)
      const subCat = allCats.find(
        (c) => c.name === subName && c.parentId === rootCat.id
      );
      if (!subCat) {
        console.error(`  Subcategory "${subName}" under "${rootName}" not found, skipping`);
        continue;
      }

      // Create grandchild categories
      const grandchildMap = new Map<string, string>(); // name -> id
      for (const gc of data.grandchildren) {
        const slug = slugify(`${subName}-${gc.name}`);
        let existing = allCats.find(
          (c) => c.name === gc.name && c.parentId === subCat.id
        );
        if (!existing) {
          existing = await prisma.category.create({
            data: {
              name: gc.name,
              slug,
              parentId: subCat.id,
              sortOrder: 0,
            },
          });
          allCats.push(existing); // keep in-memory list updated
          totalGrandchildren++;
        }
        grandchildMap.set(gc.name, existing.id);
      }

      // Create products
      for (const prod of data.products) {
        const gcId = grandchildMap.get(prod.grandchild);
        if (!gcId) {
          console.error(`    Grandchild "${prod.grandchild}" not found for product "${prod.name}"`);
          continue;
        }

        const brandId = prod.brand ? brandByName.get(prod.brand)?.id : undefined;
        if (prod.brand && !brandId) {
          console.warn(`    Brand "${prod.brand}" not found for "${prod.name}", creating without brand`);
        }

        // Check if product with same name already exists in this grandchild
        const existingProd = await prisma.product.findFirst({
          where: { name: prod.name, categoryId: gcId },
        });
        if (existingProd) {
          console.log(`  [skip] ${prod.name} already exists`);
          continue;
        }

        const product = await prisma.product.create({
          data: {
            name: prod.name,
            description: prod.description,
            categoryId: gcId,
            brandId: brandId || undefined,
            isActive: true,
            foodType: prod.foodType as any,
            productType: prod.productType as any,
            storageType: prod.storageType as any,
            countryOfOrigin: "India",
            variants: {
              create: prod.variants.map((v) => ({
                name: v.name,
                sku: nextSku(),
                unitType: v.unitType as any,
                unitValue: v.unitValue,
                mrp: v.mrp,
                packType: v.packType,
              })),
            },
          },
        });

        totalProducts++;
        totalVariants += prod.variants.length;
        console.log(`  + ${prod.name} (${prod.variants.length} variants)`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Grandchild categories created: ${totalGrandchildren}`);
  console.log(`Products created: ${totalProducts}`);
  console.log(`Variants created: ${totalVariants}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
