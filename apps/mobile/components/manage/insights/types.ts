export interface AskHighlight {
  label: string;
  value: string;
  change: string | null;
  direction: "up" | "down" | "neutral";
}

export interface AskResult {
  headline: string;
  highlights: AskHighlight[];
  insights: { label: string; detail: string }[];
  tip: string | null;
}

export type RiskLevel = "active" | "at_risk" | "churning" | "churned";

export interface ChurnCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  riskLevel: RiskLevel;
  suggestedAction: string;
}

export interface ChurnSummary {
  totalCustomers: number;
  active: number;
  atRisk: number;
  churning: number;
  churned: number;
}

export interface ChurnData {
  customers: ChurnCustomer[];
  summary: ChurnSummary;
}

export interface ReviewSummary {
  overallSentiment: string | null;
  summary: string;
  positives: string[];
  negatives: string[];
  patterns: string[];
  recommendations: string[];
  meta: {
    reviewCount: number;
    storeRatingCount: number;
    avgProductRating: number | null;
    avgStoreRating: number | null;
    periodDays: number;
  };
}

export const RISK: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#15803d", bg: "#dcfce7" },
  at_risk: { label: "At risk", color: "#b45309", bg: "#fef3c7" },
  churning: { label: "Churning", color: "#b91c1c", bg: "#fee2e2" },
  churned: { label: "Churned", color: "#475569", bg: "#e2e8f0" },
};

export const SENTIMENT: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: "Positive", color: "#15803d", bg: "#dcfce7" },
  mixed: { label: "Mixed", color: "#b45309", bg: "#fef3c7" },
  negative: { label: "Negative", color: "#b91c1c", bg: "#fee2e2" },
};
