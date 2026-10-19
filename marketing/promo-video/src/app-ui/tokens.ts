// Mirrors apps/mobile/components/manage/ui/tokens.ts so rebuilt screens match the real app
export const manage = {
  ink: "#0b2422",
  inkRaised: "#123532",
  inkText: "#e6f4f1",
  inkMuted: "#8fb5ae",
  canvas: "#f3f5f7",
  card: "#ffffff",
  line: "#e5e9ee",
  live: "#34d399",
  attention: "#fbbf24",
  attentionBg: "#fef3c7",
  attentionText: "#92400e",
  teal: "#0f766e",
  tealSoft: "#ccfbf1",
  button: "#35746d",
  text: "#0f172a",
  textSecondary: "#64748b",
  up: "#15803d",
} as const;

export const ORDER_STATUS = {
  NEW: { label: "New", color: "#b45309" },
  CONFIRMED: { label: "Confirmed", color: "#1d4ed8" },
  PREPARING: { label: "Preparing", color: "#0e7490" },
  READY: { label: "Ready", color: "#4338ca" },
  OUT: { label: "Out for delivery", color: "#6d28d9" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;
