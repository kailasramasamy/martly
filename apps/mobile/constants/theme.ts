export const colors = {
  primary: "#0f766e",
  primaryLight: "#14b8a6",
  primaryDark: "#115e59",
  accent: "#fbbf24",
  accentText: "#451a03",
  // "% OFF" sale pills: a softer amber than `accent`, with near-black text so the small label stays legible
  salePill: "#fcd34d",
  salePillText: "#1c0a00",
  secondary: "#0ea5e9",
  background: "#ffffff",
  surface: "#f8fafc",
  text: "#0f172a",
  textSecondary: "#64748b",
  border: "#e2e8f0",
  error: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSize = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const fonts = {
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
} as const;

/** Festival hero headline faces, keyed by the FestiveFont the hero designer picks; Playfair Display is the default */
export const festiveFonts: Record<string, string> = {
  PLAYFAIR: "PlayfairDisplay-Bold",
  YATRA: "YatraOne-Regular",
  KALAM: "Kalam-Bold",
  LOBSTER: "Lobster-Regular",
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 20,
} as const;
