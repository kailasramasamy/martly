import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

interface RecipeSeed {
  title: string;
  slug: string;
  description: string;
  imageUrl: string;
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  cuisineType: string;
  dietType: "VEG" | "NON_VEG" | "EGG";
  translations?: Record<string, { name: string; description?: string }>;
  ingredients: { keyword: string; displayQty: string; note?: string }[];
}

const RECIPES: RecipeSeed[] = [
  {
    title: "Masala Chai",
    slug: "masala-chai",
    description: "Aromatic Indian spiced tea with milk — the perfect morning pick-me-up.",
    imageUrl: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800",
    instructions: [
      "Crush cardamom pods and ginger lightly.",
      "Boil 2 cups water with crushed spices for 2 minutes.",
      "Add tea leaves and simmer for 1 minute.",
      "Pour in milk and bring to a rolling boil.",
      "Add sugar to taste, strain and serve hot.",
    ],
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "VEG",
    translations: { ta: { name: "மசாலா சாய்", description: "நறுமணமான இந்திய மசாலா தேநீர்" } },
    ingredients: [
      { keyword: "Tata Tea Gold", displayQty: "2 tsp", note: "loose leaf" },
      { keyword: "Full Cream Milk", displayQty: "1 cup" },
      { keyword: "Sugar", displayQty: "2 tsp" },
      { keyword: "Cardamom", displayQty: "2 pods", note: "crushed" },
    ],
  },
  {
    title: "Vegetable Pulao",
    slug: "vegetable-pulao",
    description: "Fragrant one-pot rice dish with seasonal vegetables and whole spices.",
    imageUrl: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800",
    instructions: [
      "Wash and soak basmati rice for 20 minutes, then drain.",
      "Heat ghee in a heavy-bottomed pan. Add bay leaf, cinnamon, cloves and cumin seeds.",
      "Add sliced onion and sauté until golden brown.",
      "Add chopped vegetables — capsicum, carrots, peas — and cook for 3 minutes.",
      "Add soaked rice, salt, and 2 cups water. Bring to a boil.",
      "Cover and cook on low heat for 15 minutes until rice is fluffy.",
      "Let it rest for 5 minutes, fluff with a fork and serve.",
    ],
    prepTime: 25,
    cookTime: 20,
    servings: 4,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "VEG",
    translations: { ta: { name: "காய்கறி புலாவ்", description: "நறுமணமான காய்கறி சாதம்" } },
    ingredients: [
      { keyword: "Basmati Rice", displayQty: "1.5 cups" },
      { keyword: "Pure Ghee", displayQty: "2 tbsp" },
      { keyword: "Onion", displayQty: "1 large", note: "sliced" },
      { keyword: "Green Capsicum", displayQty: "1 medium", note: "diced" },
      { keyword: "Frozen Green Peas", displayQty: "0.5 cup" },
      { keyword: "Bay Leaves", displayQty: "2 leaves" },
      { keyword: "Cumin Seeds", displayQty: "1 tsp" },
      { keyword: "Cinnamon", displayQty: "1 stick" },
    ],
  },
  {
    title: "Dal Tadka",
    slug: "dal-tadka",
    description: "Comfort food classic — yellow lentils tempered with cumin, garlic, and ghee.",
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800",
    instructions: [
      "Wash toor dal and pressure cook with turmeric until soft (3-4 whistles).",
      "Mash the cooked dal and add salt to taste.",
      "For tadka: heat ghee in a small pan.",
      "Add cumin seeds, dry red chillies, and let them splutter.",
      "Add chopped onion and sauté until golden.",
      "Add chopped tomatoes, green chillies, and cook until soft.",
      "Pour the tadka over the dal, garnish with coriander and serve with rice.",
    ],
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "VEG",
    translations: { ta: { name: "தால் தட்கா", description: "தாளிக்கப்பட்ட பருப்பு" } },
    ingredients: [
      { keyword: "Toor Dal", displayQty: "1 cup" },
      { keyword: "Turmeric Powder", displayQty: "0.5 tsp" },
      { keyword: "Cumin Seeds", displayQty: "1 tsp" },
      { keyword: "Onion", displayQty: "1 medium", note: "chopped" },
      { keyword: "Tomato", displayQty: "2 medium", note: "chopped" },
      { keyword: "Pure Ghee", displayQty: "2 tbsp" },
      { keyword: "Red Chilli", displayQty: "2 whole" },
    ],
  },
  {
    title: "Paneer Butter Masala",
    slug: "paneer-butter-masala",
    description: "Rich and creamy tomato-based curry with soft paneer cubes.",
    imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800",
    instructions: [
      "Cut paneer into cubes. Blanch tomatoes and puree them.",
      "Heat butter in a pan. Add cumin seeds and let them splutter.",
      "Add tomato puree and cook for 8-10 minutes until oil separates.",
      "Add red chilli powder, garam masala, salt and cook for 2 minutes.",
      "Add cream, stir well, and simmer for 5 minutes.",
      "Add paneer cubes gently and cook for 3-4 minutes.",
      "Garnish with cream and serve hot with naan or rice.",
    ],
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: "MEDIUM",
    cuisineType: "North Indian",
    dietType: "VEG",
    translations: { ta: { name: "பனீர் பட்டர் மசாலா", description: "கிரீமி பனீர் கறி" } },
    ingredients: [
      { keyword: "Paneer", displayQty: "250g", note: "cubed" },
      { keyword: "Tomato", displayQty: "4 medium", note: "pureed" },
      { keyword: "Butter", displayQty: "3 tbsp" },
      { keyword: "Garam Masala", displayQty: "1 tsp" },
      { keyword: "Red Chilli Powder", displayQty: "1 tsp" },
      { keyword: "Cumin Seeds", displayQty: "1 tsp" },
      { keyword: "Onion", displayQty: "1 large", note: "finely chopped" },
    ],
  },
  {
    title: "Poha",
    slug: "poha",
    description: "Light and fluffy flattened rice breakfast dish with peanuts and curry leaves.",
    imageUrl: "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=800",
    instructions: [
      "Rinse poha in water, drain and set aside. It will soften.",
      "Heat oil in a pan. Add mustard seeds and let them splutter.",
      "Add curry leaves, chopped onion, and green chillies.",
      "Sauté until onion is translucent. Add turmeric.",
      "Add the softened poha, salt, sugar, and mix gently.",
      "Squeeze lemon juice over the top and garnish with coriander and peanuts.",
    ],
    prepTime: 10,
    cookTime: 10,
    servings: 2,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "VEG",
    translations: { ta: { name: "போஹா (அவல்)", description: "அவல் உப்புமா காலை உணவு" } },
    ingredients: [
      { keyword: "Poha", displayQty: "2 cups" },
      { keyword: "Onion", displayQty: "1 medium", note: "chopped" },
      { keyword: "Peanuts", displayQty: "2 tbsp" },
      { keyword: "Mustard Seeds", displayQty: "1 tsp" },
      { keyword: "Curry Leaves", displayQty: "8-10 leaves" },
      { keyword: "Turmeric Powder", displayQty: "0.25 tsp" },
    ],
  },
  {
    title: "Curd Rice",
    slug: "curd-rice",
    description: "Simple, cooling South Indian comfort food — rice mixed with yogurt and tempered spices.",
    imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    instructions: [
      "Cook rice until very soft and let it cool slightly.",
      "Mash the rice gently and mix in curd and milk. Add salt.",
      "For tempering: heat oil, add mustard seeds, urad dal, curry leaves.",
      "Add the tempering to the rice mixture and mix well.",
      "Serve chilled or at room temperature.",
    ],
    prepTime: 5,
    cookTime: 20,
    servings: 2,
    difficulty: "EASY",
    cuisineType: "South Indian",
    dietType: "VEG",
    translations: { ta: { name: "தயிர் சாதம்", description: "குளிர்ச்சியான தயிர் சாதம்" } },
    ingredients: [
      { keyword: "Sona Masoori Rice", displayQty: "1 cup" },
      { keyword: "Curd", displayQty: "1 cup" },
      { keyword: "Toned Milk", displayQty: "0.25 cup" },
      { keyword: "Mustard Seeds", displayQty: "1 tsp" },
      { keyword: "Curry Leaves", displayQty: "8 leaves" },
    ],
  },
  {
    title: "Egg Bhurji",
    slug: "egg-bhurji",
    description: "Spicy Indian scrambled eggs with onion, tomato, and green chillies.",
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800",
    instructions: [
      "Beat eggs in a bowl with salt and turmeric.",
      "Heat oil in a pan. Add cumin seeds.",
      "Add chopped onion and sauté until golden.",
      "Add chopped tomatoes, green chillies, and cook until soft.",
      "Pour in the beaten eggs and scramble on medium heat.",
      "Cook until eggs are set but still moist. Garnish with coriander.",
      "Serve with bread or roti.",
    ],
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "EGG",
    translations: { ta: { name: "எக் பூர்ஜி", description: "மசாலா முட்டை பொரியல்" } },
    ingredients: [
      { keyword: "Brown Eggs", displayQty: "4 eggs" },
      { keyword: "Onion", displayQty: "1 medium", note: "finely chopped" },
      { keyword: "Tomato", displayQty: "1 medium", note: "chopped" },
      { keyword: "Turmeric Powder", displayQty: "0.25 tsp" },
      { keyword: "Cumin Seeds", displayQty: "0.5 tsp" },
      { keyword: "Sunflower Oil", displayQty: "1 tbsp" },
    ],
  },
  {
    title: "Aloo Gobi",
    slug: "aloo-gobi",
    description: "Dry-roasted potato and cauliflower with earthy spices — a North Indian staple.",
    imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    instructions: [
      "Cut potatoes into cubes and cauliflower into florets.",
      "Heat oil in a kadhai. Add cumin seeds and let them splutter.",
      "Add chopped onion and sauté until golden.",
      "Add turmeric, coriander powder, red chilli powder and mix.",
      "Add potatoes first, cook for 5 minutes with a splash of water.",
      "Add cauliflower, salt, cover and cook on low for 15 minutes.",
      "Stir gently, add garam masala and cook uncovered for 5 more minutes.",
    ],
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    difficulty: "EASY",
    cuisineType: "North Indian",
    dietType: "VEG",
    translations: { ta: { name: "உருளை காலிஃபிளவர்", description: "உருளை கோபி பொரியல்" } },
    ingredients: [
      { keyword: "Potato", displayQty: "3 medium", note: "cubed" },
      { keyword: "Onion", displayQty: "1 medium", note: "chopped" },
      { keyword: "Turmeric Powder", displayQty: "0.5 tsp" },
      { keyword: "Coriander Powder", displayQty: "1 tsp" },
      { keyword: "Cumin Seeds", displayQty: "1 tsp" },
      { keyword: "Red Chilli Powder", displayQty: "0.5 tsp" },
      { keyword: "Garam Masala", displayQty: "0.5 tsp" },
      { keyword: "Sunflower Oil", displayQty: "2 tbsp" },
    ],
  },
  {
    title: "Tomato Soup",
    slug: "tomato-soup",
    description: "Smooth, tangy tomato soup with a hint of butter and fresh herbs.",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800",
    instructions: [
      "Roughly chop tomatoes and onion.",
      "Heat butter in a pot. Add onion and sauté for 3 minutes.",
      "Add tomatoes, salt, pepper, and 1 cup water.",
      "Simmer for 15 minutes until tomatoes are completely soft.",
      "Blend until smooth using an immersion blender or mixer.",
      "Strain, return to pot, add sugar and adjust seasoning.",
      "Serve hot with a swirl of cream and bread on the side.",
    ],
    prepTime: 5,
    cookTime: 20,
    servings: 2,
    difficulty: "EASY",
    cuisineType: "Indian",
    dietType: "VEG",
    translations: { ta: { name: "தக்காளி சூப்", description: "கிரீமி தக்காளி சூப்" } },
    ingredients: [
      { keyword: "Tomato", displayQty: "4 large", note: "roughly chopped" },
      { keyword: "Onion", displayQty: "1 small", note: "chopped" },
      { keyword: "Butter", displayQty: "1 tbsp" },
      { keyword: "Sugar", displayQty: "1 tsp" },
      { keyword: "Black Pepper", displayQty: "0.5 tsp" },
    ],
  },
  {
    title: "Chicken Biryani",
    slug: "chicken-biryani",
    description: "Layered aromatic rice with spiced chicken, saffron, and caramelized onions.",
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800",
    instructions: [
      "Marinate chicken with curd, garam masala, red chilli, turmeric, and salt for 30 minutes.",
      "Soak basmati rice for 20 minutes, then parboil with whole spices. Drain.",
      "Heat ghee in a heavy pot. Fry sliced onions until deep golden. Remove half for garnish.",
      "Add marinated chicken to the pot and cook on high for 5 minutes.",
      "Layer parboiled rice over the chicken. Sprinkle fried onions and mint.",
      "Seal the pot with dough or tight lid. Cook on low heat for 25 minutes.",
      "Rest for 5 minutes, then gently mix layers and serve with raita.",
    ],
    prepTime: 40,
    cookTime: 35,
    servings: 6,
    difficulty: "HARD",
    cuisineType: "Hyderabadi",
    dietType: "NON_VEG",
    translations: { ta: { name: "சிக்கன் பிரியாணி", description: "ஹைதராபாதி சிக்கன் பிரியாணி" } },
    ingredients: [
      { keyword: "Chicken Curry Cut", displayQty: "500g" },
      { keyword: "Basmati Rice", displayQty: "2 cups" },
      { keyword: "Curd", displayQty: "0.5 cup" },
      { keyword: "Pure Ghee", displayQty: "3 tbsp" },
      { keyword: "Onion", displayQty: "3 large", note: "thinly sliced" },
      { keyword: "Garam Masala", displayQty: "1.5 tsp" },
      { keyword: "Red Chilli Powder", displayQty: "1 tsp" },
      { keyword: "Turmeric Powder", displayQty: "0.5 tsp" },
      { keyword: "Bay Leaves", displayQty: "2 leaves" },
      { keyword: "Cardamom", displayQty: "4 pods" },
    ],
  },
];

async function main() {
  // Get org
  const org = await prisma.organization.findFirst({
    where: { name: { contains: "Innovative" } },
  });
  if (!org) throw new Error("Innovative Foods org not found");

  console.log(`Using org: ${org.name} (${org.id})`);

  // Get all products for matching
  const products = await prisma.product.findMany({
    where: { OR: [{ organizationId: org.id }, { organizationId: null }] },
    select: { id: true, name: true },
  });
  console.log(`Found ${products.length} products for matching`);

  // Clean existing recipes
  await prisma.recipeItem.deleteMany({});
  await prisma.recipe.deleteMany({});
  console.log("Cleaned existing recipes");

  for (const [idx, recipe] of RECIPES.entries()) {
    // Match ingredients to products
    const matchedItems: { productId: string; displayQty: string; note?: string; sortOrder: number }[] = [];

    for (const [i, ing] of recipe.ingredients.entries()) {
      const product = products.find((p) =>
        p.name.toLowerCase().includes(ing.keyword.toLowerCase()),
      );
      if (product) {
        matchedItems.push({
          productId: product.id,
          displayQty: ing.displayQty,
          note: ing.note,
          sortOrder: i,
        });
      } else {
        console.log(`  [${recipe.slug}] No match for: "${ing.keyword}"`);
      }
    }

    const created = await prisma.recipe.create({
      data: {
        organizationId: org.id,
        title: recipe.title,
        slug: recipe.slug,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisineType: recipe.cuisineType,
        dietType: recipe.dietType,
        translations: recipe.translations ?? null,
        sortOrder: idx,
        isActive: true,
        items: {
          create: matchedItems,
        },
      },
      include: { _count: { select: { items: true } } },
    });

    console.log(`Created: ${created.title} (${created._count.items} ingredients matched)`);
  }

  console.log(`\nDone! ${RECIPES.length} recipes seeded.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
