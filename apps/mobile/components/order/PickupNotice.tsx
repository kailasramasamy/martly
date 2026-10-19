import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { ReturnLinesGroup } from "../../lib/types";

export function PickupNotice({ pickups }: { pickups: ReturnLinesGroup[] }) {
  return (
    <>
      {pickups.map((p) => (
        <View key={p.id} style={styles.box}>
          <Ionicons name="return-down-back-outline" size={18} color="#92400e" />
          <Text style={styles.text}>
            Keep the item from order #{p.orderId.slice(0, 8).toUpperCase()} ready {"—"} our rider will collect it
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  text: { flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: "#92400e" },
});
