import { StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";

/** The card shell and status pill shared by active and past order cards */
export const cardStyles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: "hidden" },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start" },
  pillText: { fontSize: 11.5, fontFamily: fonts.bold },
});
