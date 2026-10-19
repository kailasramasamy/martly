import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { returnState, type ReturnTone } from "@martly/shared/order-flow";
import { colors, fontSize } from "../../constants/theme";

const TONE_COLORS: Record<ReturnTone, string> = {
  pending: "#d97706",
  active: colors.primary,
  done: "#16a34a",
  declined: colors.error,
  closed: colors.textSecondary,
};

interface Props {
  request: Parameters<typeof returnState>[0];
  /** Makes the line tappable, e.g. to jump to the return card */
  onPress?: () => void;
}

/** Where an order's return stands, shown beside the Delivered status */
export function ReturnStateLine({ request, onPress }: Props) {
  const { label, tone } = returnState(request);
  const color = TONE_COLORS[tone];
  const content = (
    <View style={styles.row}>
      <Ionicons name="return-down-back" size={14} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {onPress && <Ionicons name="chevron-forward" size={14} color={color} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
      {content}
    </TouchableOpacity>
  );
}

const TAG_VERB: Record<string, string> = { PENDING: "Return requested", IN_PROGRESS: "Returning", APPROVED: "Returned" };

/** Per order line, the tag for units in the return ("Returning 1"); declined and closed returns tag nothing */
export function returnTags(request: { status: string; remedy?: string | null; items?: { orderItemId: string; quantity: number }[] } | null) {
  const verb = request && (request.status === "APPROVED" && request.remedy === "REPLACE" ? "Replaced" : TAG_VERB[request.status]);
  if (!request || !verb) return new Map<string, string>();
  return new Map((request.items ?? []).map((i) => [i.orderItemId, `${verb} · ${i.quantity}`]));
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: fontSize.sm, fontWeight: "600" },
});
