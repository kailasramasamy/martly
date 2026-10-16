import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";

/** What the rider does about money at the door: amber "Collect ₹673", or green "Paid" */
export function AmountTag({ due, large }: { due: number; large?: boolean }) {
  const collect = due > 0;
  return (
    <View style={[styles.tag, large && styles.large, collect ? styles.collect : styles.paid]}>
      <Ionicons name={collect ? "cash-outline" : "checkmark-circle"} size={large ? 22 : 15} color={collect ? manage.attentionText : "#15803d"} />
      <Text style={[styles.text, large && styles.textLarge, tabular, { color: collect ? manage.attentionText : "#15803d" }]}>
        {collect ? `Collect ${formatINR(due)}` : "Paid"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 26, paddingHorizontal: 9, borderRadius: 13 },
  large: { height: 48, paddingHorizontal: 14, borderRadius: 12, alignSelf: "stretch", gap: 10 },
  collect: { backgroundColor: colors.accent },
  paid: { backgroundColor: "#dcfce7" },
  text: { fontFamily: fonts.extrabold, fontSize: 12.5 },
  textLarge: { fontSize: 20 },
});
