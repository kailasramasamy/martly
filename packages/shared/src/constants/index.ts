export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
  STORE_MANAGER: "STORE_MANAGER",
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const StoreStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const;
export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const UnitType = {
  KG: "KG",
  GRAM: "GRAM",
  LITER: "LITER",
  ML: "ML",
  PIECE: "PIECE",
  PACK: "PACK",
  DOZEN: "DOZEN",
  BUNDLE: "BUNDLE",
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitTypeLabels: Record<UnitType, string> = {
  KG: "Kilogram",
  GRAM: "Gram",
  LITER: "Liter",
  ML: "Milliliter",
  PIECE: "Piece",
  PACK: "Pack",
  DOZEN: "Dozen",
  BUNDLE: "Bundle",
};

export const FoodType = {
  VEG: "VEG",
  NON_VEG: "NON_VEG",
  VEGAN: "VEGAN",
  EGG: "EGG",
} as const;
export type FoodType = (typeof FoodType)[keyof typeof FoodType];

export const FoodTypeLabels: Record<FoodType, string> = {
  VEG: "Vegetarian",
  NON_VEG: "Non-Vegetarian",
  VEGAN: "Vegan",
  EGG: "Egg",
};

export const ProductType = {
  GROCERY: "GROCERY",
  SNACKS: "SNACKS",
  BEVERAGES: "BEVERAGES",
  DAIRY: "DAIRY",
  FROZEN: "FROZEN",
  FRESH_PRODUCE: "FRESH_PRODUCE",
  BAKERY: "BAKERY",
  PERSONAL_CARE: "PERSONAL_CARE",
  HOUSEHOLD: "HOUSEHOLD",
  BABY_CARE: "BABY_CARE",
  PET_CARE: "PET_CARE",
  OTC_PHARMA: "OTC_PHARMA",
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeLabels: Record<ProductType, string> = {
  GROCERY: "Grocery",
  SNACKS: "Snacks",
  BEVERAGES: "Beverages",
  DAIRY: "Dairy",
  FROZEN: "Frozen",
  FRESH_PRODUCE: "Fresh Produce",
  BAKERY: "Bakery",
  PERSONAL_CARE: "Personal Care",
  HOUSEHOLD: "Household",
  BABY_CARE: "Baby Care",
  PET_CARE: "Pet Care",
  OTC_PHARMA: "OTC Pharma",
};

export const StorageType = {
  AMBIENT: "AMBIENT",
  REFRIGERATED: "REFRIGERATED",
  DEEP_CHILLED: "DEEP_CHILLED",
  FROZEN: "FROZEN",
  COOL_DRY: "COOL_DRY",
  HUMIDITY_CONTROLLED: "HUMIDITY_CONTROLLED",
} as const;
export type StorageType = (typeof StorageType)[keyof typeof StorageType];

export const StorageTypeLabels: Record<StorageType, string> = {
  AMBIENT: "Room Temperature",
  REFRIGERATED: "Refrigerated (2-8°C)",
  DEEP_CHILLED: "Deep Chilled (0-2°C)",
  FROZEN: "Frozen (-18°C)",
  COOL_DRY: "Cool & Dry",
  HUMIDITY_CONTROLLED: "Humidity Controlled",
};

export const RegulatoryMark = {
  FSSAI: "FSSAI",
  ISI: "ISI",
  AGMARK: "AGMARK",
  BIS: "BIS",
  ORGANIC_INDIA: "ORGANIC_INDIA",
  HALAL: "HALAL",
  KOSHER: "KOSHER",
  ECOMARK: "ECOMARK",
  FPO: "FPO",
} as const;
export type RegulatoryMark = (typeof RegulatoryMark)[keyof typeof RegulatoryMark];

export const RegulatoryMarkLabels: Record<RegulatoryMark, string> = {
  FSSAI: "FSSAI",
  ISI: "ISI Mark",
  AGMARK: "AGMARK",
  BIS: "BIS Certification",
  ORGANIC_INDIA: "Organic India",
  HALAL: "Halal",
  KOSHER: "Kosher",
  ECOMARK: "Ecomark",
  FPO: "FPO Mark",
};
