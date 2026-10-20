import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { ReturnLinesGroup } from "../../lib/types";

export function PickupNotice({ pickups }: { pickups: ReturnLinesGroup[] }) {
  const t = useStrings("orders").item;
  return (
    <>
      {pickups.map((p) => (
        <View key={p.id} style={styles.box}>
          <Ionicons name="return-down-back-outline" size={18} color="#92400e" />
          <Text style={styles.text}>
            {t.pickupNotice(p.orderId.slice(0, 8).toUpperCase())}
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
