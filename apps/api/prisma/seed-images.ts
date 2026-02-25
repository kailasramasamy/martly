import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

// Search term mapping: product name substring -> Unsplash search query
const SEARCH_MAP: Record<string, string> = {
  // Food - Fruits
  "Alphonso Mango": "mango fruit",
  "Imported Kiwi": "kiwi fruit sliced",
  "Nagpur Orange": "orange fruit",
  "Banana Robusta": "banana bunch",
  // Food - Vegetables
  "Spinach (Palak)": "fresh spinach leaves",
  "Ooty Carrot": "fresh carrots",
  "Bottle Gourd": "bottle gourd vegetable",
  "Onion": "onion pile",
  // Food - Dairy
  "Taaza Toned Milk": "milk carton",
  "Mother Dairy Classic Curd": "yogurt bowl",
  "Fresh Paneer": "paneer cottage cheese",
  "Pasteurised Butter": "butter block",
  // Food - Grains & Cereals
  "India Gate Basmati": "basmati rice grain",
  "Aashirvaad Superior": "wheat flour atta",
  "Thick Poha": "flattened rice poha",
  "Yogabar Crunchy Muesli": "muesli granola bowl",
  // Food - Cooking Oil
  "Fortune Sunlite": "sunflower oil bottle",
  "Dhara Kachi Ghani": "mustard oil bottle",
  "Saffola Aura Olive": "olive oil bottle",
  "Parachute Pure Coconut": "coconut oil jar",
  // Food - Spices
  "MDH Whole Coriander": "coriander seeds spice",
  "Everest Turmeric": "turmeric powder spice",
  "MDH Deggi Mirch": "red chili powder",
  "Catch Chaat Masala": "spice powder mix",
  // Food - Snacks
  "Lay's Classic Salted": "potato chips bag",
  "Haldiram's Aloo Bhujia": "indian namkeen snack",
  "Parle-G Gold": "biscuit cookies stack",
  "Maggi 2-Minute": "instant noodles packet",
  // Food - Beverages
  "Coca-Cola Original": "cola soft drink bottle",
  "Tropicana Orange Juice": "orange juice glass",
  "Bisleri Mineral Water": "water bottle",
  "Paper Boat Aam Panna": "mango drink",
  // Food - Frozen Food
  "McCain French Fries": "french fries frozen",
  "Sumeru Frozen Green Peas": "frozen green peas",
  "Amul Vanilla Ice Cream": "vanilla ice cream tub",
  "Godrej Yummiez Veg Burger": "veggie burger patty",
  // Food - Bakery
  "Britannia White Bread": "white bread loaf",
  "Britannia Fruit Cake": "fruit cake slice",
  "Parle Premium Rusk": "rusk toast",
  "Britannia Good Day Cashew": "cashew cookies",
  // Food - Pulses
  "Toor Dal": "toor dal lentil",
  "Moong Dal": "moong dal yellow lentil",
  "Chana Dal": "chana dal bengal gram",
  "Masoor Dal": "red lentil masoor",
  // Food - Dry Fruits
  "California Almonds": "almonds nuts",
  "Goa Cashews": "cashew nuts",
  "Green Raisins": "raisins dried grapes",
  "True Elements Mix": "mixed nuts seeds",
  // Food - Canned
  "Del Monte Sweet Corn": "canned corn",
  "Mother's Recipe Mixed Pickle": "indian pickle jar",
  "Kissan Mixed Fruit Jam": "fruit jam jar",
  "MTR Rava Idli Mix": "idli breakfast",
  // Food - Sauces
  "Kissan Fresh Tomato Ketchup": "tomato ketchup bottle",
  "Knorr Schezwan": "chili sauce bottle",
  "Borges White Wine Vinegar": "vinegar bottle",
  "Dr. Oetker FunFoods": "mayonnaise jar",
  // Food - Meat
  "Fresh Chicken Breast": "raw chicken breast",
  "Goat Curry Cut": "raw goat meat",
  "Rohu Fish Curry": "fresh raw fish",
  "ITC Master Chef Chicken Seekh": "seekh kebab",
  // Food - Eggs
  "White Hen Eggs": "white eggs carton",
  "Free Range Brown Eggs": "brown eggs",
  "Organic Country Eggs": "organic farm eggs",
  "Liquid Egg Whites": "egg whites",
  // Food - Ready to Eat
  "MTR Ready to Eat Rajma": "rajma masala curry",
  "Gits Ready Meals Dal": "dal makhani",
  "Knorr Cup Noodles": "cup noodles",
  "Knorr Classic Tomato Soup": "tomato soup bowl",
  // Food - Tea & Coffee
  "Tata Tea Gold": "tea leaves chai",
  "Organic Tattva Green Tea": "green tea cup",
  "Nescafe Classic Instant": "instant coffee jar",
  "Bru Filter Coffee": "filter coffee powder",
  // Food - Chocolates
  "Cadbury Dairy Milk Silk": "chocolate bar milk",
  "Parle Kismi Toffee": "toffee candy",
  "Haldiram's Gulab Jamun": "gulab jamun sweet",
  "Ferrero Rocher Gift": "ferrero rocher chocolate box",

  // Personal Care - Face Wash
  "Himalaya Neem Face Wash": "face wash gel bottle",
  "Mamaearth Tea Tree Face Wash": "tea tree face wash",
  "Nivea Milk Delights": "cream face wash",
  "Himalaya Walnut Scrub": "face scrub",
  // Personal Care - Shampoo
  "Head & Shoulders": "shampoo bottle blue",
  "Sunsilk Lusciously": "purple shampoo bottle",
  "Pantene Smooth": "shampoo conditioner gold",
  "Dabur Vatika Henna & Olive": "herbal shampoo green",
  // Personal Care - Soap
  "Lux Soft Touch": "pink bar soap",
  "Dettol Original Bar": "green bar soap",
  "Medimix Classic": "ayurvedic herbal soap",
  "Dove Cream Beauty": "white bar soap dove",
  // Personal Care - Skincare
  "Nivea Soft Moisturizing": "moisturizer cream jar",
  "Mamaearth Ultra Light Sunscreen": "sunscreen lotion tube",
  "Himalaya Nourishing Skin": "face cream jar",
  "Nivea Nourishing Body": "body lotion pump",
  // Personal Care - Haircare
  "Parachute Advansed Coconut": "coconut oil hair",
  "Pantene Pro-V Conditioner": "hair conditioner bottle",
  "Mamaearth Onion Hair Serum": "hair serum dropper",
  "Dabur Vatika Henna Hair Color": "hair dye color",
  // Personal Care - Oral Care
  "Colgate Strong Teeth": "toothpaste tube",
  "Colgate Slim Soft": "toothbrush",
  "Closeup Eucalyptus Mint": "mouthwash green bottle",
  "Sensodyne Dental Floss": "dental floss",
  // Personal Care - Deodorant
  "Nivea Fresh Active Roll": "roll on deodorant",
  "Dove Men+Care": "deodorant spray can",
  "Nivea Men Deep Impact": "stick deodorant",
  "Mamaearth Underarm": "natural deodorant roll on",

  // Household - Floor Cleaner
  "Lizol Disinfectant": "floor cleaner disinfectant",
  "Domex Fresh Guard": "surface cleaner bottle",
  "Harpic Bathroom": "toilet cleaner bottle",
  "Scotch-Brite Flat Mop": "flat mop cleaning",
  // Household - Detergent
  "Surf Excel Easy Wash": "washing powder detergent",
  "Ariel Matic Liquid": "liquid detergent bottle",
  "Rin Detergent Bar": "detergent soap bar",
  "Comfort After Wash": "fabric softener purple",
  // Household - Dishwash
  "Vim Dishwash Liquid Gel": "dish soap liquid",
  "Vim Dishwash Bar": "dish wash bar",
  "Vim Anti Smell": "dishwashing gel",
  "Scotch-Brite Green Scrub": "scrub pad sponge green",
  // Household - Kitchen Supplies
  "Freshwrapp Aluminium": "aluminium foil roll",
  "Freshwrapp Cling": "plastic cling wrap",
  "Ezee Garbage Bags Medium": "garbage bags black roll",
  "Scott Kitchen Towel": "paper towel roll",
  // Household - Insect Repellent
  "All Out Ultra": "mosquito repellent plugin",
  "Good Knight Power": "electric mosquito repellent",
  "Mortein Mosquito Coil": "mosquito coil green",
  "Mortein Rapid Action Spray": "insect spray aerosol",
  // Household - Air Freshener
  "Odonil Room Air": "room freshener spray",
  "Odonil Gel Pocket": "gel air freshener small",
  "Ambi Pur Car": "car air freshener clip",
  "Cycle Pure Agarbatti": "incense sticks burning",
  // Household - Garbage Bags
  "Ezee Bio-degradable": "biodegradable garbage bags",
  "Ezee Garbage Bags Medium Black": "black garbage bags",
  "Ezee Garbage Bags Large": "large trash bags",
  "BeyondGreen Compostable": "compostable green bags",

  // Baby Care - Diapers
  "Pampers Premium Care": "baby diaper pack",
  "Huggies Wonder Pants": "baby diaper pants",
  "Pampers Active Baby Tape": "newborn baby diaper",
  "Johnson's Baby Wipes": "baby wipes pack",
  // Baby Care - Baby Food
  "Cerelac Wheat Apple": "baby cereal food jar",
  "Nestle Cerelac Rice Veg": "baby food puree",
  "Nestle Lactogen": "infant formula milk can",
  "Cerelac Nutri Puffs": "baby puffs snack",
  // Baby Care - Baby Skincare
  "Johnson's Baby Milk + Rice": "baby lotion bottle",
  "Johnson's Baby Oil": "baby oil bottle",
  "Himalaya Gentle Baby Wash": "baby wash soap",
  "Himalaya Diaper Rash": "diaper rash cream tube",

  // OTC Pharma - Pain Relief
  "Crocin Advance": "paracetamol tablets strip",
  "Moov Pain Relief Spray": "pain relief spray",
  "Zandu Balm Ultra": "pain balm jar",
  "Moov Strong Diclofenac": "pain gel tube",
  // OTC Pharma - Cold & Cough
  "Dabur Honitus": "cough syrup bottle",
  "Vicks Cough Drops": "cough drops lozenges",
  "Otrivin Nasal Spray": "nasal spray bottle",
  "Vicks VapoRub": "vapor rub ointment",
  // OTC Pharma - Digestive
  "Eno Fruit Salt": "antacid powder sachet",
  "Dabur Hajmola": "digestive tablets bottle",
  "Isabgol Psyllium": "psyllium husk powder",
  "Zandu Pancharishta": "ayurvedic tonic bottle",
  // OTC Pharma - Antiseptic
  "Dettol Antiseptic Liquid": "antiseptic liquid brown",
  "Dettol Antiseptic Cream": "antiseptic cream tube",
  "Band-Aid Flexible": "bandaid adhesive strips",
  "Lifebuoy Hand Sanitizer": "hand sanitizer bottle",

  // Pet Care - Pet Food
  "Pedigree Adult Chicken": "dog food kibble bag",
  "Whiskas Adult Ocean Fish": "cat food pack",
  "Pedigree Dentastix": "dog treats dental",
  "Whiskas Temptations": "cat treats pack",
  // Pet Care - Pet Hygiene
  "Drools Anti-Tick": "dog shampoo bottle",
  "Himalaya Erina": "pet tick flea spray",
  "Pedigree Pet Grooming": "pet grooming wipes",
  "Drools Cat Litter": "cat litter bag",
};

async function fetchUnsplashUrl(query: string): Promise<string | null> {
  const encoded = encodeURIComponent(query);
  try {
    const res = await fetch(
      `https://unsplash.com/napi/search/photos?query=${encoded}&per_page=5`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const results = data.results || [];

    for (const r of results) {
      const raw: string = r.urls?.raw || "";
      // Prefer images.unsplash.com (free) over plus.unsplash.com (premium)
      const freeMatch = raw.match(
        /(https:\/\/images\.unsplash\.com\/photo-[^?]+)/
      );
      if (freeMatch) return freeMatch[1];
    }
    // Fallback: accept any URL including plus.unsplash.com
    for (const r of results) {
      const raw: string = r.urls?.raw || "";
      const anyMatch = raw.match(/(https:\/\/[^?]+)/);
      if (anyMatch) return anyMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  // Get all products without images
  const products = await prisma.product.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${products.length} products without images`);

  let updated = 0;
  let failed = 0;

  for (const product of products) {
    // Find matching search term
    let searchQuery: string | null = null;
    for (const [key, query] of Object.entries(SEARCH_MAP)) {
      if (product.name.includes(key)) {
        searchQuery = query;
        break;
      }
    }

    if (!searchQuery) {
      // Fallback: use product name as search query
      searchQuery = product.name;
    }

    const imageUrl = await fetchUnsplashUrl(searchQuery);
    if (imageUrl) {
      const finalUrl = `${imageUrl}?w=400&h=400&fit=crop`;
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: finalUrl },
      });
      updated++;
      console.log(`  [ok] ${product.name}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${product.name} (query: "${searchQuery}")`);
    }

    // Small delay to be nice to Unsplash
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
