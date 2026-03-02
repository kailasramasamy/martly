import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

// Aliases map: product name pattern → aliases
// These cover common Indian grocery misspellings, transliterations, and semantic terms
const PRODUCT_ALIASES: Record<string, string[]> = {
  // Brand misspellings
  "Maggi": ["magee", "maggii", "magi", "meggi", "magie"],
  "Amul": ["amool", "amull"],
  "Haldiram": ["haldirams", "haldiram's", "haldiramm"],
  "Britannia": ["britania", "britaniya", "britanya"],
  "Parle": ["parlay", "parlee"],
  "Cadbury": ["cadberry", "cadbery", "cadburey"],
  "Nestle": ["nestlé", "neslay"],
  "Colgate": ["colgate", "coalgate"],
  "Dettol": ["detol", "dettoll"],
  "Surf Excel": ["surfexcel", "surf exel", "surf excell"],
  "Tata Tea": ["tata chai", "tatatea"],
  "Bisleri": ["bislery", "bislerri"],

  // Category aliases / transliterations
  "Atta": ["wheat flour", "aata", "gehun ka atta", "chapati flour"],
  "Besan": ["gram flour", "chickpea flour", "besan flour"],
  "Maida": ["all purpose flour", "refined flour", "maida flour"],
  "Sooji": ["suji", "semolina", "rava", "rawa"],
  "Poha": ["flattened rice", "chivda", "beaten rice", "avalakki"],
  "Ragi Flour": ["finger millet flour", "nachni flour", "ragi atta"],
  "Rice Flour": ["chawal ka atta", "rice powder"],

  // Dal / Lentils
  "Toor Dal": ["arhar dal", "tuvar dal", "pigeon pea"],
  "Masoor Dal": ["red lentils", "masur dal", "pink lentils"],
  "Moong Dal": ["mung dal", "green gram", "mung bean"],
  "Chana Dal": ["bengal gram", "split chickpea"],
  "Urad Dal": ["black gram", "urad daal", "uddina bele"],
  "Rajma": ["kidney beans", "rajmah"],

  // Dairy
  "Paneer": ["cottage cheese", "paner", "panir"],
  "Ghee": ["clarified butter", "ghi", "desi ghee"],
  "Curd": ["yogurt", "yoghurt", "dahi"],
  "Milk": ["doodh", "dudh"],

  // Spices
  "Turmeric Powder": ["haldi", "haldi powder"],
  "Red Chilli Powder": ["lal mirch", "mirchi powder", "red chili"],
  "Coriander Powder": ["dhaniya powder", "dhania"],
  "Cumin Seeds": ["jeera", "jira"],
  "Garam Masala": ["garam masla", "mixed spices"],
  "Asafoetida": ["hing", "heeng"],
  "Mustard Seeds": ["rai", "sarson", "musturd"],
  "Fennel Seeds": ["saunf", "sauf"],
  "Fenugreek Seeds": ["methi", "methi seeds"],
  "Black Pepper": ["kali mirch", "pepper"],
  "Cardamom": ["elaichi", "ilaychi"],
  "Cinnamon Sticks": ["dalchini", "cinnamon"],
  "Cloves": ["laung", "lavang"],
  "Bay Leaves": ["tej patta", "bay leaf"],

  // Sweeteners
  "Sugar": ["cheeni", "shakkar"],
  "Jaggery": ["gur", "gud", "bella"],

  // Produce
  "Fresh Potato": ["aloo", "aaloo", "batata"],
  "Fresh Onion": ["pyaaz", "pyaj", "kanda"],
  "Fresh Tomato": ["tamatar", "tomater"],
  "Fresh Spinach": ["palak", "saag"],
  "Fresh Cucumber": ["kheera", "kakdi"],
  "Bottle Gourd": ["lauki", "ghiya", "doodhi"],
  "Fresh Green Capsicum": ["shimla mirch", "bell pepper"],
  "Curry Leaves": ["kadi patta", "karivepaku"],
  "Ooty Carrot": ["gajar", "carrot"],

  // Oils
  "Mustard Oil": ["sarson ka tel", "musturd oil"],
  "Coconut Oil": ["nariyal tel", "coconut tel"],

  // Semantic / use-case aliases
  "Yogabar Crunchy Muesli": ["healthy breakfast", "diet breakfast", "fitness cereal"],
  "Organic Tattva Green Tea": ["healthy tea", "diet tea", "green tea"],
  "Nescafe Classic Instant Coffee": ["coffee", "kaapi", "koffee"],
  "Brooke Bond Red Label Tea": ["chai", "chai patti", "tea leaves"],
  "Bread": ["pav", "bun"],
  "Basmati Rice": ["biryani rice", "long grain rice"],
  "Kissan Fresh Tomato Ketchup": ["sauce", "tomato sauce"],
  "Knorr Classic Tomato Soup": ["soup", "instant soup"],
  "Bingo Mad Angles": ["party snacks", "munchies"],
  "Kurkure": ["party snacks", "kurkurey", "kurkuri"],
  "Lay's": ["chips", "wafers", "lays"],
  "Coca-Cola": ["coke", "cold drink", "soft drink", "soda"],
  "Eno Fruit Salt": ["acidity", "gas relief", "antacid"],
  "Crocin": ["fever medicine", "headache medicine", "paracetamol"],
  "Isabgol": ["constipation", "fiber supplement"],
};

async function main() {
  console.log("Seeding search aliases...");

  // Get all products
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  });

  let created = 0;

  for (const product of products) {
    // Find matching aliases for this product
    for (const [pattern, aliases] of Object.entries(PRODUCT_ALIASES)) {
      if (product.name.toLowerCase().includes(pattern.toLowerCase())) {
        for (const alias of aliases) {
          // Check if alias already exists for this product
          const existing = await prisma.searchAlias.findFirst({
            where: { productId: product.id, alias },
          });
          if (!existing) {
            await prisma.searchAlias.create({
              data: {
                productId: product.id,
                alias,
                source: "seed",
              },
            });
            created++;
          }
        }
      }
    }
  }

  console.log(`Created ${created} search aliases for ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
