import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { actionLabel } from "./order-flow";
import type { OrderListItem } from "./types";

interface BulkBarProps {
  selected: OrderListItem[];
  /** Forward status shared by every selected order, if there is one */
  nextStatus: string | undefined;
  running: boolean;
  onAdvance: (status: string) => void;
  onCancel: () => void;
  onClear: () => void;
}

export function BulkBar({ selected, nextStatus, running, onAdvance, onCancel, onClear }: BulkBarProps) {
  const fulfillment = selected[0]?.fulfillmentType ?? "DELIVERY";

  return (
    <View style={styles.bar}>
      <View style={styles.head}>
        <TouchableOpacity style={styles.close} onPress={onClear} accessibilityLabel="Clear selection">
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.count}>{selected.length} selected</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Cancel orders" variant="danger" compact onPress={onCancel} disabled={running} style={styles.action} />
        {nextStatus ? (
          <Button label={actionLabel(nextStatus, fulfillment)} compact onPress={() => onAdvance(nextStatus)} loading={running} style={styles.action} />
        ) : (
          <Text style={styles.hint}>Pick orders in the same stage to move them together</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 10, padding: 12, backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginLeft: -4 },
  actions: { flexDirection: "row", gap: 10, alignItems: "center" },
  action: { flex: 1 },
  hint: { flex: 2, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
});
