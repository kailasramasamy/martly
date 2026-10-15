export interface DemandRow {
  storeProductId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  currentStock: number;
  avgDailyDemand: number;
  daysOfStockLeft: number;
  totalQuantitySold: number;
  totalOrders: number;
  lastOrderDate: string;
}

export type Urgency = "critical" | "warning" | "info";

export interface ReorderRow extends DemandRow {
  suggestedReorderQty: number;
  urgency: Urgency;
}

export type AnomalyType = "demand_spike" | "demand_drop" | "stock_mismatch" | "dead_stock";

export interface AnomalyRow {
  type: AnomalyType;
  severity: "high" | "medium" | "low";
  storeProductId: string;
  productName: string;
  variantName: string;
  message: string;
  details: Record<string, unknown>;
}

type Tone = { label: string; color: string; bg: string };

export const URGENCY: Record<Urgency, Tone> = {
  critical: { label: "Critical", color: "#b91c1c", bg: "#fee2e2" },
  warning: { label: "Warning", color: "#b45309", bg: "#fef3c7" },
  info: { label: "Info", color: "#1d4ed8", bg: "#dbeafe" },
};

export const ANOMALY_TYPE: Record<AnomalyType, Tone> = {
  demand_spike: { label: "Demand spike", color: "#c2410c", bg: "#ffedd5" },
  demand_drop: { label: "Demand drop", color: "#1d4ed8", bg: "#dbeafe" },
  stock_mismatch: { label: "Stock mismatch", color: "#b91c1c", bg: "#fee2e2" },
  dead_stock: { label: "Dead stock", color: "#475569", bg: "#e2e8f0" },
};

export const SEVERITY_COLOR: Record<AnomalyRow["severity"], string> = {
  high: "#b91c1c",
  medium: "#f59e0b",
  low: "#94a3b8",
};

export function daysLeftTone(days: number): Tone {
  if (days === -1) return { label: "No demand", color: "#475569", bg: "#e2e8f0" };
  const label = `${days.toFixed(1)}d left`;
  if (days <= 3) return { label, color: "#b91c1c", bg: "#fee2e2" };
  if (days <= 7) return { label, color: "#b45309", bg: "#fef3c7" };
  return { label, color: "#15803d", bg: "#dcfce7" };
}
