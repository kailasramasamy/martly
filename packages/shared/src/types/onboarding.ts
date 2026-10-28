import type { StoreSize, SubcategoryTier } from "../constants/onboarding.js";
import type { StoreStatus } from "../constants/index.js";

/** A store being set up, with how far each wizard step has got */
export interface OnboardingSummary {
  storeId: string;
  storeName: string;
  status: StoreStatus;
  organization: { id: string; name: string; slug: string };
  owner: { id: string; name: string; phone: string | null; email: string } | null;
  size: StoreSize | null;
  region: string | null;
  listings: number;
  storefrontCopied: boolean;
  createdAt: string;
  /** Set when the store went live from the wizard */
  launchedAt: string | null;
}

export interface ProposalBrand {
  id: string | null;
  name: string;
  regional: boolean;
  products: number;
}

export interface ProposalAisle {
  id: string;
  name: string;
  tier: SubcategoryTier;
  /** Carried in the proposal: in the size's tiers or opted in, and not excluded */
  included: boolean;
  /** Candidate products before the brand and product caps */
  available: number;
  products: number;
  /** Of `products`, those visible at launch; the rest are hidden suggestions */
  likely: number;
  variants: number;
  brands: ProposalBrand[];
}

export interface ProposalCategory { id: string; name: string; aisles: ProposalAisle[] }
export interface ProposalDepartment { id: string; name: string; categories: ProposalCategory[] }

export interface ProposalProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  brand: { id: string; name: string; regional: boolean } | null;
  /** Visible at launch; otherwise listed hidden as a suggestion */
  likely: boolean;
  variants: { id: string; name: string; mrp: number | null; listed: boolean }[];
}

export interface CatalogProposal {
  region: string | null;
  size: StoreSize;
  brandsPerAisle: number;
  productsPerAisle: number;
  likelyPerAisle: number;
  totals: {
    aisles: number; brands: number; products: number; variants: number; needsPrice: number; listed: number;
    /** Products visible at launch, and products listed hidden as suggestions */
    visible: number; suggested: number;
  };
  departments: ProposalDepartment[];
  /** The requested aisle's proposed products */
  products?: ProposalProduct[];
  /** The requested aisle's brands left out: below the cap, or (not eligible) from another region or hidden */
  otherBrands?: (ProposalBrand & { eligible: boolean })[];
}

export interface UnpricedItem { variantId: string; productName: string; variantName: string; aisle: string }

export interface ApplyCatalogResult { created: number; removed: number; kept: number; needsPrice: number }

export interface StorefrontCopyResult {
  collections: number;
  droppedCollections: string[];
  sections: number;
  skippedSections: number;
  banners: number;
  membershipPlans: number;
  deliverySlots: number;
  loyalty: boolean;
  referrals: boolean;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  /** Launch is blocked until required checks pass */
  required: boolean;
  detail?: string;
  /** Wizard step that fixes it */
  step: number;
}

/** Someone who works at the store, other than the owner */
export interface OnboardingTeamMember {
  userId: string;
  name: string;
  phone: string | null;
  /** Null when the login is OTP only */
  email: string | null;
  role: "STORE_MANAGER" | "STAFF" | "RIDER";
}
