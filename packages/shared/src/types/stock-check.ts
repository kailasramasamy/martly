/** How a set of listings stands on "does the store carry it" */
export interface StockCheckCounts {
  total: number;
  carried: number;
  notCarried: number;
  /** Not confirmed either way: onboarding's guesses */
  unchecked: number;
  /** Unconfirmed and hidden: onboarding's less likely picks */
  suggested: number;
}

export interface StockCheckDepartment extends StockCheckCounts {
  id: string;
  name: string;
  /** A few product photos so the department is recognisable at a glance */
  sampleImages: string[];
}

export interface StockCheckSummary extends StockCheckCounts {
  checkedToday: number;
  departments: StockCheckDepartment[];
}

export interface StockCheckBrand extends StockCheckCounts {
  /** Brand id, or "none" for unbranded */
  id: string;
  name: string;
  imageUrl: string | null;
  sampleImages: string[];
}

export interface StockCheckSize {
  storeProductId: string;
  variantName: string;
  mrp: number | null;
  price: number;
  carried: boolean | null;
  isActive: boolean;
  suggested: boolean;
}

export interface StockCheckProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  sizes: StockCheckSize[];
}

export interface StockCheckEditResult {
  /** Every listing the edit saved (repriced or new), all now carried */
  storeProductIds: string[];
}

export interface StockCheckResult {
  updated: number;
  /** Pass to undo to take this call back */
  batch: string;
}
