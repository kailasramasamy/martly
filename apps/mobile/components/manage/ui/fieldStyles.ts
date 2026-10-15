import { StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "./tokens";

/** Shared label / box / hint styles so every form control lines up */
export const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginBottom: 6 },
  required: { color: colors.error },
  box: {
    flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 12,
    borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card,
  },
  boxError: { borderColor: colors.error },
  boxDisabled: { backgroundColor: manage.canvas },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  placeholder: { color: manage.muted },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 5 },
  error: { fontFamily: fonts.semibold, fontSize: 12, color: colors.error, marginTop: 5 },
});
