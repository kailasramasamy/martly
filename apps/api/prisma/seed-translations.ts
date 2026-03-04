import { PrismaClient, Prisma } from "../generated/prisma";

const prisma = new PrismaClient();

// ── Category translations (Tamil) ──
const categoryTranslations: Record<string, { ta: { name: string } }> = {
  // Top-level
  "Baby Care": { ta: { name: "குழந்தை பராமரிப்பு" } },
  "Cleaning & Laundry": { ta: { name: "சுத்தம் & சலவை" } },
  "Food": { ta: { name: "உணவு" } },
  "Grocery": { ta: { name: "மளிகை" } },
  "Household": { ta: { name: "வீட்டு உபயோகம்" } },
  "OTC Pharma": { ta: { name: "மருந்தகம்" } },
  "Personal Care": { ta: { name: "தனிப்பட்ட பராமரிப்பு" } },
  "Pet Care": { ta: { name: "செல்லப்பிராணி பராமரிப்பு" } },

  // Grocery subcategories
  "Rice": { ta: { name: "அரிசி" } },
  "Pulses & Lentils": { ta: { name: "பருப்பு வகைகள்" } },
  "Flours & Grains": { ta: { name: "மாவு & தானியங்கள்" } },
  "Edible Oils": { ta: { name: "சமையல் எண்ணெய்" } },
  "Spices & Masala": { ta: { name: "மசாலா & பொருட்கள்" } },
  "Sugar & Salt": { ta: { name: "சர்க்கரை & உப்பு" } },
  "Dry Fruits & Nuts": { ta: { name: "உலர் பழங்கள் & கொட்டைகள்" } },
  "Grains & Cereals": { ta: { name: "தானியங்கள்" } },

  // Food subcategories
  "Dairy": { ta: { name: "பால் பொருட்கள்" } },
  "Fruits": { ta: { name: "பழங்கள்" } },
  "Vegetables": { ta: { name: "காய்கறிகள்" } },
  "Snacks": { ta: { name: "தின்பண்டங்கள்" } },
  "Beverages": { ta: { name: "பானங்கள்" } },
  "Bakery": { ta: { name: "பேக்கரி" } },
  "Frozen Food": { ta: { name: "உறைந்த உணவு" } },
  "Eggs": { ta: { name: "முட்டைகள்" } },
  "Meat": { ta: { name: "இறைச்சி" } },
  "Sauces & Condiments": { ta: { name: "சாஸ் & காரங்கள்" } },
  "Ready to Eat": { ta: { name: "சமைத்த உணவு" } },
  "Instant Meals": { ta: { name: "உடனடி உணவு" } },
  "Chocolates & Sweets": { ta: { name: "சாக்லேட் & இனிப்புகள்" } },

  // Dairy
  "Milk": { ta: { name: "பால்" } },
  "Curd & Yogurt": { ta: { name: "தயிர்" } },
  "Butter & Ghee": { ta: { name: "வெண்ணெய் & நெய்" } },
  "Paneer & Cheese": { ta: { name: "பன்னீர் & சீஸ்" } },
  "Ice Cream": { ta: { name: "ஐஸ்கிரீம்" } },

  // Vegetables
  "Everyday Vegetables": { ta: { name: "தினசரி காய்கறிகள்" } },
  "Leafy Greens": { ta: { name: "கீரை வகைகள்" } },
  "Root Vegetables": { ta: { name: "கிழங்கு வகைகள்" } },
  "Gourds & Squash": { ta: { name: "சுரைக்காய் வகைகள்" } },

  // Fruits
  "Everyday Fruits": { ta: { name: "தினசரி பழங்கள்" } },
  "Citrus Fruits": { ta: { name: "சிட்ரஸ் பழங்கள்" } },
  "Exotic Fruits": { ta: { name: "அயல்நாட்டு பழங்கள்" } },
  "Seasonal Fruits": { ta: { name: "பருவகால பழங்கள்" } },

  // Beverages
  "Tea & Coffee": { ta: { name: "தேநீர் & காபி" } },
  "Juices": { ta: { name: "பழச்சாறு" } },
  "Soft Drinks": { ta: { name: "குளிர்பானங்கள்" } },
  "Packaged Water": { ta: { name: "தண்ணீர்" } },

  // Snacks
  "Biscuits": { ta: { name: "பிஸ்கட்" } },
  "Chips & Crisps": { ta: { name: "சிப்ஸ்" } },
  "Namkeen": { ta: { name: "நமக்கீன்" } },
  "Chocolates": { ta: { name: "சாக்லேட்" } },
  "Cookies": { ta: { name: "குக்கீஸ்" } },

  // Pulses
  "Toor Dal": { ta: { name: "துவரம் பருப்பு" } },
  "Moong Dal": { ta: { name: "பாசிப்பருப்பு" } },
  "Chana Dal": { ta: { name: "கடலைப்பருப்பு" } },
  "Masoor Dal": { ta: { name: "மசூர் பருப்பு" } },

  // Spices
  "Whole Spices": { ta: { name: "முழு மசாலா" } },
  "Ground Spices": { ta: { name: "பொடி மசாலா" } },
  "Blended Masala": { ta: { name: "கலப்பு மசாலா" } },
  "Seasonings": { ta: { name: "சுவையூட்டிகள்" } },

  // Oils
  "Cooking Oil": { ta: { name: "சமையல் எண்ணெய்" } },
  "Coconut Oil": { ta: { name: "தேங்காய் எண்ணெய்" } },
  "Mustard Oil": { ta: { name: "கடுகு எண்ணெய்" } },
  "Olive Oil": { ta: { name: "ஆலிவ் எண்ணெய்" } },
  "Sunflower Oil": { ta: { name: "சூரியகாந்தி எண்ணெய்" } },
  "Groundnut Oil": { ta: { name: "நிலக்கடலை எண்ணெய்" } },

  // Personal Care
  "Oral Care": { ta: { name: "வாய் பராமரிப்பு" } },
  "Haircare": { ta: { name: "முடி பராமரிப்பு" } },
  "Skincare": { ta: { name: "சரும பராமரிப்பு" } },
  "Soap": { ta: { name: "சோப்பு" } },
  "Deodorant": { ta: { name: "டியோடரண்ட்" } },
  "Shampoo": { ta: { name: "ஷாம்பு" } },
  "Toothpaste": { ta: { name: "பற்பசை" } },
  "Toothbrush": { ta: { name: "பல் தூரிகை" } },
  "Face Wash": { ta: { name: "முகம் கழுவி" } },

  // Cleaning
  "Detergents": { ta: { name: "சலவை பொருட்கள்" } },
  "Dishwash": { ta: { name: "பாத்திரம் கழுவி" } },
  "Floor Cleaners": { ta: { name: "தரை சுத்திகரிப்பான்" } },
  "Toilet & Bathroom": { ta: { name: "கழிவறை & குளியலறை" } },
  "Kitchen Supplies": { ta: { name: "சமையலறை பொருட்கள்" } },

  // Baby Care
  "Diapers": { ta: { name: "டயப்பர்கள்" } },
  "Baby Food": { ta: { name: "குழந்தை உணவு" } },
  "Baby Skincare": { ta: { name: "குழந்தை சரும பராமரிப்பு" } },

  // Bakery
  "Bread": { ta: { name: "ரொட்டி" } },
  "Cakes & Pastries": { ta: { name: "கேக் & பேஸ்ட்ரி" } },
  "Rusk & Toast": { ta: { name: "ரஸ்க் & டோஸ்ட்" } },

  // Household
  "Insect Repellent": { ta: { name: "பூச்சி விரட்டி" } },
  "Air Freshener": { ta: { name: "காற்று புத்துணர்வு" } },
  "Garbage Bags": { ta: { name: "குப்பை பைகள்" } },

  // Health
  "Pain Relief": { ta: { name: "வலி நிவாரணம்" } },
  "Cold & Cough": { ta: { name: "சளி & இருமல்" } },
  "Digestive": { ta: { name: "செரிமானம்" } },
};

// ── Product translations (Tamil) ──
const productTranslations: Record<string, { ta: { name: string; description?: string } }> = {
  // Rice
  "Basmati Rice": { ta: { name: "பாஸ்மதி அரிசி" } },
  "India Gate Basmati Rice": { ta: { name: "இந்தியா கேட் பாஸ்மதி அரிசி" } },

  // Pulses
  "Chana Dal": { ta: { name: "கடலைப்பருப்பு" } },
  "Moong Dal": { ta: { name: "பாசிப்பருப்பு" } },
  "Toor Dal": { ta: { name: "துவரம் பருப்பு" } },
  "Masoor Dal": { ta: { name: "மசூர் பருப்பு" } },
  "Black Eyed Peas": { ta: { name: "கராமணி" } },
  "Besan": { ta: { name: "கடலை மாவு" } },

  // Flours
  "Aashirvaad Superior MP Atta": { ta: { name: "ஆஷிர்வாத் கோதுமை மாவு" } },
  "Wheat & Atta": { ta: { name: "கோதுமை & ஆட்டா" } },

  // Dairy
  "Amul Gold Full Cream Milk": { ta: { name: "அமுல் கோல்ட் முழு பால்" } },
  "Amul Taaza Toned Milk": { ta: { name: "அமுல் டாஸா டோன்ட் பால்" } },
  "Amul Pasteurised Butter": { ta: { name: "அமுல் வெண்ணெய்" } },
  "Amul Salted Butter": { ta: { name: "அமுல் உப்பு வெண்ணெய்" } },
  "Amul Pure Ghee": { ta: { name: "அமுல் நெய்" } },
  "Amul Fresh Paneer": { ta: { name: "அமுல் பன்னீர்" } },
  "Amul Chocolate Ice Cream": { ta: { name: "அமுல் சாக்லேட் ஐஸ்கிரீம்" } },
  "Amul Vanilla Ice Cream": { ta: { name: "அமுல் வெண்ணிலா ஐஸ்கிரீம்" } },

  // Fruits
  "Fresh Apple (Shimla)": { ta: { name: "ஆப்பிள் (ஷிம்லா)" } },
  "Fresh Banana (Robusta)": { ta: { name: "வாழைப்பழம் (ரோபஸ்டா)" } },
  "Banana Robusta": { ta: { name: "வாழைப்பழம் ரோபஸ்டா" } },
  "Fresh Orange (Nagpur)": { ta: { name: "ஆரஞ்சு (நாக்பூர்)" } },
  "Fresh Pomegranate": { ta: { name: "மாதுளை" } },
  "Fresh Papaya": { ta: { name: "பப்பாளி" } },
  "Alphonso Mango": { ta: { name: "அல்போன்சா மாம்பழம்" } },
  "Imported Kiwi": { ta: { name: "கிவி பழம்" } },

  // Vegetables
  "Fresh Tomato": { ta: { name: "தக்காளி" } },
  "Fresh Onion": { ta: { name: "வெங்காயம்" } },
  "Fresh Potato": { ta: { name: "உருளைக்கிழங்கு" } },
  "Fresh Cucumber": { ta: { name: "வெள்ளரிக்காய்" } },
  "Fresh Green Capsicum": { ta: { name: "குடை மிளகாய்" } },
  "Fresh Spinach (Palak)": { ta: { name: "பசலைக்கீரை (பாலக்)" } },
  "Bottle Gourd (Lauki)": { ta: { name: "சுரைக்காய்" } },
  "Curry Leaves": { ta: { name: "கறிவேப்பிலை" } },

  // Spices
  "Black Pepper": { ta: { name: "மிளகு" } },
  "Cumin Seeds": { ta: { name: "சீரகம்" } },
  "Coriander Powder": { ta: { name: "கொத்தமல்லி பொடி" } },
  "Everest Turmeric Powder": { ta: { name: "எவரெஸ்ட் மஞ்சள் பொடி" } },
  "Garam Masala": { ta: { name: "கரம் மசாலா" } },
  "Cardamom": { ta: { name: "ஏலக்காய்" } },
  "Cinnamon Sticks": { ta: { name: "பட்டை" } },
  "Cloves": { ta: { name: "கிராம்பு" } },
  "Bay Leaves": { ta: { name: "பிரியாணி இலை" } },
  "Fennel Seeds": { ta: { name: "பெருஞ்சீரகம்" } },
  "Fenugreek Seeds": { ta: { name: "வெந்தயம்" } },
  "Asafoetida": { ta: { name: "பெருங்காயம்" } },
  "Dry Red Chillies": { ta: { name: "காய்ந்த மிளகாய்" } },
  "Catch Chaat Masala": { ta: { name: "கேட்ச் சாட் மசாலா" } },

  // Oils
  "Fortune Sunlite Refined Sunflower Oil": { ta: { name: "ஃபார்ச்சூன் சூரியகாந்தி எண்ணெய்" } },
  "Fortune Sunlite Sunflower Oil": { ta: { name: "ஃபார்ச்சூன் சூரியகாந்தி எண்ணெய்" } },
  "Dhara Kachi Ghani Mustard Oil": { ta: { name: "தாரா கடுகு எண்ணெய்" } },
  "Fortune Rice Bran Health Oil": { ta: { name: "ஃபார்ச்சூன் அரிசி தவிடு எண்ணெய்" } },
  "Groundnut Oil": { ta: { name: "நிலக்கடலை எண்ணெய்" } },

  // Sugar & Salt
  "Iodized Salt": { ta: { name: "அயோடின் உப்பு" } },

  // Tea & Coffee
  "Brooke Bond Red Label Tea": { ta: { name: "ப்ரூக் பாண்ட் ரெட் லேபிள் தேநீர்" } },
  "Bru Instant Coffee": { ta: { name: "ப்ரூ இன்ஸ்டன்ட் காபி" } },
  "Bru Filter Coffee": { ta: { name: "ப்ரூ ஃபில்டர் காபி" } },

  // Beverages
  "Coca-Cola Original": { ta: { name: "கோகா-கோலா" } },
  "B Natural Mixed Fruit Juice": { ta: { name: "பி நேச்சுரல் கலப்பு பழச்சாறு" } },
  "Bisleri Mineral Water": { ta: { name: "பிஸ்லேரி தண்ணீர்" } },

  // Bread & Bakery
  "Britannia White Bread": { ta: { name: "பிரிட்டானியா வெள்ளை ரொட்டி" } },
  "Britannia Brown Bread": { ta: { name: "பிரிட்டானியா பிரவுன் ரொட்டி" } },
  "Britannia Good Day Butter Cookies": { ta: { name: "பிரிட்டானியா குட் டே வெண்ணெய் குக்கீஸ்" } },
  "Britannia Good Day Cashew Cookies": { ta: { name: "பிரிட்டானியா குட் டே முந்திரி குக்கீஸ்" } },
  "Britannia Fruit Cake": { ta: { name: "பிரிட்டானியா பழ கேக்" } },
  "Britannia Cheese Slices": { ta: { name: "பிரிட்டானியா சீஸ் ஸ்லைஸ்" } },

  // Snacks
  "Haldiram's Aloo Bhujia": { ta: { name: "ஹல்திராம்ஸ் உருளை பூஜியா" } },
  "Haldiram's Moong Dal": { ta: { name: "ஹல்திராம்ஸ் பாசிப்பருப்பு" } },
  "Haldiram's Navratan Mixture": { ta: { name: "ஹல்திராம்ஸ் நவரத்தின மிக்ஸ்சர்" } },
  "Bikaji Bhujia Sev": { ta: { name: "பிகாஜி பூஜியா சேவ்" } },
  "Bingo Mad Angles Achaari Masti": { ta: { name: "பிங்கோ மேட் ஆங்கிள்ஸ்" } },

  // Chocolates
  "Cadbury Dairy Milk Silk": { ta: { name: "கேட்பரி டெய்ரி மில்க் சில்க்" } },
  "5 Star 3D Chocolate Bar": { ta: { name: "5 ஸ்டார் 3D சாக்லேட்" } },
  "Ferrero Rocher Gift Box": { ta: { name: "ஃபெரெரோ ரோச்சர் பரிசு பெட்டி" } },

  // Sweets
  "Haldiram's Gulab Jamun Tin": { ta: { name: "ஹல்திராம்ஸ் குலாப் ஜாமூன்" } },
  "Haldiram's Soan Papdi": { ta: { name: "ஹல்திராம்ஸ் சோன் பப்டி" } },
  "Bikaji Rasgulla": { ta: { name: "பிகாஜி ரசகுல்லா" } },

  // Dry Fruits
  "Almonds": { ta: { name: "பாதாம்" } },
  "California Almonds": { ta: { name: "கலிஃபோர்னியா பாதாம்" } },
  "Cashews": { ta: { name: "முந்திரி" } },
  "Goa Cashews W320": { ta: { name: "கோவா முந்திரி W320" } },
  "Green Raisins (Kishmish)": { ta: { name: "திராட்சை (கிஷ்மிஷ்)" } },
  "Mixed Nuts": { ta: { name: "கலப்பு கொட்டைகள்" } },

  // Meat
  "Fresh Chicken Breast": { ta: { name: "கோழி மார்பு" } },
  "Fresh Chicken Breast Boneless": { ta: { name: "கோழி மார்பு எலும்பில்லா" } },
  "Fresh Chicken Curry Cut": { ta: { name: "கோழி குழம்பு வெட்டு" } },
  "Fresh Chicken Drumsticks": { ta: { name: "கோழி கால்கள்" } },
  "Fresh Mutton Curry Cut": { ta: { name: "ஆட்டிறைச்சி குழம்பு வெட்டு" } },
  "Goat Curry Cut (Bone-In)": { ta: { name: "ஆட்டிறைச்சி (எலும்புடன்)" } },
  "Fresh Rohu Fish": { ta: { name: "ரோகு மீன்" } },

  // Eggs
  "Farm Fresh White Eggs (6 pcs)": { ta: { name: "பண்ணை வெள்ளை முட்டை (6)" } },
  "Country Fresh Brown Eggs (6 pcs)": { ta: { name: "பிரவுன் முட்டை (6)" } },
  "Happy Hens Farm Eggs (12 pcs)": { ta: { name: "பண்ணை முட்டை (12)" } },

  // Personal Care
  "Colgate Strong Teeth Toothpaste": { ta: { name: "கோல்கேட் ஸ்ட்ராங் டீத் பற்பசை" } },
  "Colgate Slim Soft Toothbrush": { ta: { name: "கோல்கேட் பல் தூரிகை" } },
  "Dove Cream Beauty Bar": { ta: { name: "டவ் கிரீம் சோப்பு" } },
  "Dettol Original Bar Soap": { ta: { name: "டெட்டால் சோப்பு" } },
  "Dettol Antiseptic Liquid": { ta: { name: "டெட்டால் கிருமிநாசினி" } },
  "Head & Shoulders Anti-Dandruff Shampoo": { ta: { name: "ஹெட் & ஷோல்டர்ஸ் பொடுகு ஷாம்பு" } },
  "Himalaya Neem Face Wash": { ta: { name: "ஹிமாலயா வேம்பு முகம் கழுவி" } },

  // Cleaning
  "Harpic Power Plus Original": { ta: { name: "ஹார்பிக் கழிவறை சுத்திகரிப்பான்" } },
  "Domex Floor Cleaner Lemon": { ta: { name: "டோமெக்ஸ் தரை சுத்திகரிப்பான்" } },
  "Ariel Matic Liquid Detergent": { ta: { name: "ஏரியல் திரவ சலவை" } },
  "Colin Glass Cleaner Spray": { ta: { name: "காலின் கண்ணாடி சுத்திகரிப்பான்" } },
  "Comfort After Wash Fabric Conditioner": { ta: { name: "கம்ஃபோர்ட் துணி மென்மையாக்கி" } },

  // Noodles & Ready
  "Gits Ready Meals Dal Makhani": { ta: { name: "கிட்ஸ் தால் மக்கனி" } },
  "Gits Ready Meals Pav Bhaji": { ta: { name: "கிட்ஸ் பாவ் பாஜி" } },
  "Chole": { ta: { name: "கொண்டைக்கடலை" } },

  // Sauces
  "Dr. Oetker FunFoods Veg Mayonnaise": { ta: { name: "டாக்டர் ஓட்கர் மயோனைஸ்" } },

  // Baby
  "Himalaya Gentle Baby Wash": { ta: { name: "ஹிமாலயா குழந்தை குளியல்" } },
  "Huggies Wonder Pants L": { ta: { name: "ஹக்கீஸ் டயப்பர் L" } },

  // Frozen
  "Del Monte Sweet Corn Kernels": { ta: { name: "டெல் மான்டே இனிப்பு சோளம்" } },
};

async function main() {
  console.log("Seeding Tamil translations...\n");

  // Update categories
  let catUpdated = 0;
  for (const [name, translations] of Object.entries(categoryTranslations)) {
    const result = await prisma.category.updateMany({
      where: { name },
      data: { translations: translations as unknown as Prisma.InputJsonValue },
    });
    if (result.count > 0) {
      catUpdated += result.count;
      console.log(`  ✓ Category: ${name} → ${translations.ta.name}`);
    } else {
      console.log(`  ⚠ Category not found: ${name}`);
    }
  }

  // Update products
  let prodUpdated = 0;
  for (const [name, translations] of Object.entries(productTranslations)) {
    const result = await prisma.product.updateMany({
      where: { name },
      data: { translations: translations as unknown as Prisma.InputJsonValue },
    });
    if (result.count > 0) {
      prodUpdated += result.count;
      console.log(`  ✓ Product: ${name} → ${translations.ta.name}`);
    } else {
      console.log(`  ⚠ Product not found: ${name}`);
    }
  }

  // Trigger search index update for products with translations
  console.log("\nUpdating search index for translated products...");
  const translatedProducts = await prisma.product.findMany({
    where: { translations: { not: Prisma.DbNull } },
    select: { id: true },
  });
  // Touch each product to trigger the search index update
  for (const p of translatedProducts) {
    await prisma.$executeRawUnsafe(`UPDATE products SET name = name WHERE id = '${p.id}'`);
  }

  console.log(`\nDone! Updated ${catUpdated} categories and ${prodUpdated} products.`);
  console.log(`Search index refreshed for ${translatedProducts.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
