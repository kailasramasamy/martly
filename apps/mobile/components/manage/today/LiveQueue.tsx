import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { ORDER_STATUS, manage, tabular } from "../ui/tokens";
import type { StatusCounts } from "../orders/use-status-counts";

export const QUEUE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

interface LiveQueueProps {
  counts: StatusCounts;
  onSelect: (status: string) => void;
}

export function LiveQueue({ counts, onSelect }: LiveQueueProps) {
  return (
    <View style={styles.row}>
      {QUEUE_STATUSES.map((status) => {
        const cfg = ORDER_STATUS[status];
        const count = counts[status] ?? 0;
        const needsAttention = status === "PENDING" && count > 0;
        return (
          <TouchableOpacity
            key={status}
            style={[styles.cell, needsAttention && styles.cellAttention]}
            onPress={() => onSelect(status)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${count} ${cfg.label} orders`}
          >
            <Text style={[styles.count, tabular, { color: needsAttention ? manage.attentionText : colors.text }]}>{count}</Text>
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: cfg.color }]} />
              <Text style={styles.label} numberOfLines={1}>{cfg.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line,
    backgroundColor: manage.card, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 8,
  },
  cellAttention: { backgroundColor: manage.attentionBg, borderColor: manage.attention },
  count: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
});
