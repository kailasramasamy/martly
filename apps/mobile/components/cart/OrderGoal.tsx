import { View, Text, StyleSheet } from "react-native";
import { amount } from "../../lib/money";
import { Ionicons } from "@expo/vector-icons";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, spacing } from "../../constants/theme";

interface OrderGoalProps {
  /** "minimum": checkout is locked until the target; "freeDelivery": the fee goes at the target */
  kind: "minimum" | "freeDelivery";
  target: number;
  total: number;
}

const TONES = {
  minimum: { icon: "alert-circle", fg: "#c2410c", bg: "#fff7ed", border: "#fed7aa", track: "#fed7aa" },
  freeDelivery: { icon: "bicycle", fg: colors.primary, bg: colors.primary + "0D", border: colors.primary + "30", track: colors.primary + "26" },
} as const;

/** How far the cart is from the minimum order or free delivery, as a bar */
export function OrderGoal({ kind, target, total }: OrderGoalProps) {
  const t = useStrings("cart");
  const tone = TONES[kind];
  const more = amount(target - total);
  const progress = `${Math.min(100, Math.max(4, (total / target) * 100))}%` as const;

  return (
    <View style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.header}>
        <Ionicons name={tone.icon} size={18} color={tone.fg} />
        <Text style={[styles.text, { color: tone.fg }]}>
          {kind === "minimum" ? t.belowMinimum(more, amount(target)) : t.belowFreeDelivery(more)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: tone.track }]}>
        <View style={[styles.fill, { width: progress, backgroundColor: tone.fg }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});
