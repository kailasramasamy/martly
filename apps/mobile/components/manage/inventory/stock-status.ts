import { colors } from "../../../constants/theme";
import { manage } from "../ui/tokens";

export const LOW_STOCK_THRESHOLD = 5;

export type StockState = "in" | "low" | "out";

export function stockState(available: number): StockState {
  if (available <= 0) return "out";
  return available <= LOW_STOCK_THRESHOLD ? "low" : "in";
}

export const STOCK_STATE: Record<StockState, { label: string; color: string; bg: string }> = {
  in: { label: "In stock", color: "#15803d", bg: "#dcfce7" },
  low: { label: "Low stock", color: manage.attentionText, bg: manage.attentionBg },
  out: { label: "Out of stock", color: colors.error, bg: "#fee2e2" },
};
