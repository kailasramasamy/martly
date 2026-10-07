import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

/**
 * Maps category/department names (lowercase) to Ionicons icon names.
 * Used across CategoryCard, CategoryGridCard, and home screen.
 */
const CATEGORY_ICON_MAP: Record<string, IoniconsName> = {
  // Departments (16)
  "baby care": "happy-outline",
  bakery: "cafe-outline",
  beverages: "wine-outline",
  dairy: "water-outline",
  "frozen foods": "snow-outline",
  "fruits & vegetables": "nutrition-outline",
  "gourmet & world foods": "globe-outline",
  "grocery & staples": "cart-outline",
  "home care": "home-outline",
  "meat, fish & eggs": "flame-outline",
  "paan corner": "leaf-outline",
  "personal care": "body-outline",
  "pet care": "paw-outline",
  "pooja & festivals": "flower-outline",
  "snacks & packaged foods": "pizza-outline",
  "stationery & general merchandise": "pencil-outline",

  // Common categories / subcategories
  fruits: "nutrition-outline",
  vegetables: "leaf-outline",
  "grains & cereals": "apps-outline",
  "cooking oil": "flask-outline",
  "edible oils": "flask-outline",
  "spices & masala": "flame-outline",
  spices: "flame-outline",
  snacks: "pizza-outline",
  "frozen food": "snow-outline",
  "pulses & lentils": "ellipse-outline",
  "dry fruits & nuts": "sunny-outline",
  "canned & packaged": "cube-outline",
  "sauces & condiments": "color-fill-outline",
  meat: "flame-outline",
  eggs: "egg-outline",
  fish: "fish-outline",
  "ready to eat": "fast-food-outline",
  "tea & coffee": "cafe-outline",
  "chocolates & sweets": "heart-outline",
  "sugar & salt": "cube-outline",
  "flours & grains": "apps-outline",
  grains: "apps-outline",
  rice: "apps-outline",
  atta: "apps-outline",

  // Personal Care
  skincare: "sparkles-outline",
  haircare: "cut-outline",
  "oral care": "happy-outline",
  shampoo: "water-outline",
  soap: "sparkles-outline",
  deodorant: "cloud-outline",

  // Home Care
  detergent: "shirt-outline",
  dishwash: "water-outline",
  "floor cleaner": "sparkles-outline",
  "air freshener": "cloud-outline",
  "insect repellent": "bug-outline",
  "kitchen supplies": "restaurant-outline",
  "garbage bags": "trash-outline",

  // Baby Care
  diapers: "shirt-outline",
  "baby food": "nutrition-outline",

  // Pet Care
  "pet food": "fish-outline",

  // Bakery
  bread: "cafe-outline",
  cakes: "cafe-outline",

  // Beverages
  "soft drinks": "wine-outline",
  juices: "wine-outline",
  water: "water-outline",

  // Dairy
  milk: "water-outline",
  cheese: "cube-outline",
  butter: "cube-outline",
  yogurt: "water-outline",
  curd: "water-outline",
  paneer: "cube-outline",
};

/** Returns an Ionicons name for a category, falling back to "pricetag-outline". */
export function getCategoryIcon(name: string): IoniconsName {
  return CATEGORY_ICON_MAP[name.toLowerCase()] ?? "pricetag-outline";
}
