import { colors } from "../../../constants/theme";

/** Manage-persona palette: the consumer tokens plus an ink band and hairlines for dense operational UI */
export const manage = {
  ink: "#0b2422",
  inkRaised: "#123532",
  inkText: "#e6f4f1",
  inkMuted: "#8fb5ae",
  canvas: "#f3f5f7",
  card: "#ffffff",
  line: "#e5e9ee",
  hairline: "#eef1f4",
  muted: "#94a3b8",
  tint: "#ecfdf8",
  live: "#34d399",
  attention: colors.accent,
  attentionBg: "#fef3c7",
  attentionText: "#92400e",
} as const;

/** Tabular figures so counts and amounts align in lists and KPI tiles */
export const tabular = { fontVariant: ["tabular-nums" as const] };

export const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "New", color: "#b45309", bg: "#fef3c7" },
  CONFIRMED: { label: "Confirmed", color: "#1d4ed8", bg: "#dbeafe" },
  PREPARING: { label: "Preparing", color: "#0e7490", bg: "#cffafe" },
  READY: { label: "Ready", color: "#4338ca", bg: "#e0e7ff" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "#6d28d9", bg: "#ede9fe" },
  DELIVERED: { label: "Delivered", color: "#15803d", bg: "#dcfce7" },
  CANCELLED: { label: "Cancelled", color: "#b91c1c", bg: "#fee2e2" },
};

export const PAYMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Unpaid", color: "#b45309", bg: "#fef3c7" },
  PAID: { label: "Paid", color: "#15803d", bg: "#dcfce7" },
  FAILED: { label: "Failed", color: "#b91c1c", bg: "#fee2e2" },
};

export function formatINR(value: number | string, opts: { decimals?: boolean } = {}): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: opts.decimals ? 2 : 0 })}`;
}
