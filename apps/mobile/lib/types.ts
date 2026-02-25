export interface Store {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  status?: string;
}

export interface Variant {
  id: string;
  name: string;
  unitType: string;
  unitValue: string;
  mrp: number | null;
  imageUrl: string | null;
}

export interface Pricing {
  effectivePrice: number;
  originalPrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
}

export interface StoreProduct {
  id: string;
  price: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
  variantId: string;
  variant: Variant;
  pricing?: Pricing;
  product: Product;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  brand: { id: string; name: string } | null;
  foodType: string | null;
  productType: string | null;
  regulatoryMarks: string[];
  certifications: string[];
  dangerWarnings: string | null;
  category?: { id: string; name: string } | null;
  variants?: Variant[];
  nutritionalInfo?: Record<string, string> | null;
  ingredients?: string | null;
  allergens?: string | null;
  storageInstructions?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
}

export interface UserAddress {
  id: string;
  userId: string;
  label: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  _count?: { products: number };
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

export interface CollectionSection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  products: StoreProduct[];
}

export interface TimeCategorySection {
  id: string;
  name: string;
  slug: string;
  products: StoreProduct[];
}

export interface HomeFeed {
  collections: CollectionSection[];
  categories: CategoryTreeNode[];
  timeCategories: TimeCategorySection[];
  timePeriod: string;
  deals: StoreProduct[];
  buyAgain: StoreProduct[];
}
