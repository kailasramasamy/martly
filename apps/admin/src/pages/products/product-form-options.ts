export const UNIT_TYPES = ["KG", "GRAM", "LITER", "ML", "PIECE", "PACK", "DOZEN", "BUNDLE"];

export const STORAGE_TYPES = [
  { label: "Room Temperature", value: "AMBIENT" },
  { label: "Refrigerated (2-8°C)", value: "REFRIGERATED" },
  { label: "Deep Chilled (0-2°C)", value: "DEEP_CHILLED" },
  { label: "Frozen (-18°C)", value: "FROZEN" },
  { label: "Cool & Dry", value: "COOL_DRY" },
  { label: "Humidity Controlled", value: "HUMIDITY_CONTROLLED" },
];

export const FOOD_TYPES = [
  { label: "Vegetarian", value: "VEG" },
  { label: "Non-Vegetarian", value: "NON_VEG" },
  { label: "Vegan", value: "VEGAN" },
  { label: "Egg", value: "EGG" },
];

export const GST_OPTIONS = [
  { label: "0%", value: 0 },
  { label: "5%", value: 5 },
  { label: "12%", value: 12 },
  { label: "18%", value: 18 },
  { label: "28%", value: 28 },
];

export const COMMON_ALLERGENS = [
  "Gluten", "Milk", "Eggs", "Tree Nuts", "Peanuts", "Soy", "Fish", "Shellfish", "Sesame", "Mustard", "Celery", "Sulphites",
];

export const PRODUCT_TYPES = [
  { label: "Grocery", value: "GROCERY" },
  { label: "Snacks", value: "SNACKS" },
  { label: "Beverages", value: "BEVERAGES" },
  { label: "Dairy", value: "DAIRY" },
  { label: "Frozen", value: "FROZEN" },
  { label: "Fresh Produce", value: "FRESH_PRODUCE" },
  { label: "Bakery", value: "BAKERY" },
  { label: "Personal Care", value: "PERSONAL_CARE" },
  { label: "Household", value: "HOUSEHOLD" },
  { label: "Baby Care", value: "BABY_CARE" },
  { label: "Pet Care", value: "PET_CARE" },
  { label: "OTC Pharma", value: "OTC_PHARMA" },
];

export const REGULATORY_MARKS = [
  { label: "FSSAI", value: "FSSAI" },
  { label: "ISI Mark", value: "ISI" },
  { label: "AGMARK", value: "AGMARK" },
  { label: "BIS Certification", value: "BIS" },
  { label: "Organic India", value: "ORGANIC_INDIA" },
  { label: "Halal", value: "HALAL" },
  { label: "Kosher", value: "KOSHER" },
  { label: "Ecomark", value: "ECOMARK" },
  { label: "FPO Mark", value: "FPO" },
];

export const COMMON_CERTIFICATIONS = [
  { label: "Organic", value: "Organic" },
  { label: "Cruelty-Free", value: "Cruelty-Free" },
  { label: "ISO 22000", value: "ISO 22000" },
  { label: "GMP", value: "GMP" },
  { label: "HACCP", value: "HACCP" },
  { label: "Vegan Certified", value: "Vegan Certified" },
  { label: "Dermatologically Tested", value: "Dermatologically Tested" },
];

export const STORAGE_INSTRUCTIONS = [
  "Store in a cool, dry place",
  "Keep refrigerated (2-8°C)",
  "Store below 25°C",
  "Keep frozen (-18°C or below)",
  "Store in a cool, dry place away from direct sunlight",
  "Refrigerate after opening",
  "Keep in an airtight container after opening",
  "Store in a dry place away from moisture",
  "Do not freeze",
  "Use within 3 days of opening",
  "Keep away from heat and humidity",
  "Store at room temperature",
];

export const PACK_TYPES = [
  "Pouch", "Box", "Bottle", "Can", "Jar", "Sachet", "Packet", "Bag",
  "Carton", "Tin", "Tube", "Blister Pack", "Wrapper", "Tray", "Cup",
  "Tetra Pack", "Stand-up Pouch", "Squeeze Bottle", "Spray Bottle", "Tub",
];

export interface SubcategoryNode { id: string; name: string; }
export interface CategoryNode { id: string; name: string; subcategories: SubcategoryNode[]; }
export interface DepartmentNode { id: string; name: string; categories: CategoryNode[]; }

export interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

export function buildCascaderOptions(departments: DepartmentNode[]): CascaderOption[] {
  return departments.map((d) => ({
    value: d.id,
    label: d.name,
    children: d.categories.map((c) => ({
      value: c.id,
      label: c.name,
      children: c.subcategories.map((s) => ({
        value: s.id,
        label: s.name,
      })),
    })),
  }));
}

export function findCategoryPath(departments: DepartmentNode[], targetId: string): string[] | null {
  for (const d of departments) {
    for (const c of d.categories) {
      for (const s of c.subcategories) {
        if (s.id === targetId) return [d.id, c.id, s.id];
      }
      if (c.id === targetId) return [d.id, c.id];
    }
    if (d.id === targetId) return [d.id];
  }
  return null;
}
