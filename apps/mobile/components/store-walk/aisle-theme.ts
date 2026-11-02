import { colors } from "../../constants/theme";

/** The aisles' colours, light like the rest of the app */
export const AISLE = {
  floor: colors.surface,
  panel: colors.background,
  line: colors.border,
  text: colors.text,
  muted: colors.textSecondary,
  accent: colors.primary,
} as const;
