import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

/**
 * Maps category names (lowercase) to Ionicons icon names.
 * Used across CategoryCard, CategoryGridCard, and home screen placeholders.
 */
const CATEGORY_ICON_MAP: Record<string, IoniconsName> = {
  // Top-level
  grocery: "cart-outline",
  food: "restaurant-outline",
  "personal care": "body-outline",
  household: "home-outline",
  "baby care": "happy-outline",
  "otc pharma": "medkit-outline",
  "pet care": "paw-outline",

  // Food subcategories
  dairy: "water-outline",
  "grains & cereals": "apps-outline",
  "cooking oil": "flask-outline",
  "spices & masala": "flame-outline",
  snacks: "pizza-outline",
  beverages: "wine-outline",
  "frozen food": "snow-outline",
  bakery: "cafe-outline",
  fruits: "nutrition-outline",
  vegetables: "leaf-outline",
  "pulses & lentils": "ellipse-outline",
  "dry fruits & nuts": "sunny-outline",
  "canned & packaged": "cube-outline",
  "sauces & condiments": "color-fill-outline",
  meat: "flame-outline",
  eggs: "egg-outline",
  "ready to eat": "fast-food-outline",
  "tea & coffee": "cafe-outline",
  "chocolates & sweets": "heart-outline",

  // Grocery subcategories (from AI catalog seed)
  "edible oils": "flask-outline",
  spices: "flame-outline",
  "sugar & salt": "cube-outline",
  "flours & grains": "apps-outline",
  grains: "apps-outline",

  // Personal Care subcategories
  "face wash": "sparkles-outline",
  shampoo: "water-outline",
  toothpaste: "sparkles-outline",
  soap: "sparkles-outline",
  deodorant: "cloud-outline",
  skincare: "sparkles-outline",
  haircare: "cut-outline",
  "oral care": "happy-outline",

  // Household subcategories
  "floor cleaner": "sparkles-outline",
  detergent: "shirt-outline",
  "insect repellent": "bug-outline",
  "kitchen supplies": "restaurant-outline",
  dishwash: "water-outline",
  "air freshener": "cloud-outline",
  "garbage bags": "trash-outline",

  // Baby Care subcategories
  diapers: "shirt-outline",
  "baby food": "nutrition-outline",
  "baby skincare": "sparkles-outline",

  // OTC Pharma subcategories
  "pain relief": "bandage-outline",
  "cold & cough": "thermometer-outline",
  digestive: "fitness-outline",
  antiseptic: "medkit-outline",

  // Pet Care subcategories
  "pet food": "fish-outline",
  "pet hygiene": "paw-outline",
};

/** Returns an Ionicons name for a category, falling back to "pricetag-outline". */
export function getCategoryIcon(name: string): IoniconsName {
  return CATEGORY_ICON_MAP[name.toLowerCase()] ?? "pricetag-outline";
}
