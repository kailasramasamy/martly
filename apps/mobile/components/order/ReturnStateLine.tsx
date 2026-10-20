import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { returnState, type ReturnTone } from "@martly/shared/order-flow";
import { colors, fontSize } from "../../constants/theme";
import { strings, type Strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";

const TONE_COLORS: Record<ReturnTone, string> = {
  pending: "#d97706",
  active: colors.primary,
  done: "#16a34a",
  declined: colors.error,
  closed: colors.textSecondary,
};

interface Props {
  request: Parameters<typeof returnState>[0];
}

function stateLabel(request: Props["request"], t: Strings<"orders">["returns"]) {
  switch (request.status) {
    case "PENDING":
      return t.stateRequested;
    case "IN_PROGRESS":
      return request.remedy === "REPLACE" && request.method === "KEEP" ? t.stateReplacementComing : t.stateInProgress;
    case "APPROVED":
      return request.remedy === "REPLACE" ? t.stateReplaced : t.stateRefunded(`\u20B9${Math.round(Number(request.approvedAmount ?? 0)).toLocaleString("en-IN")}`);
    case "REJECTED":
      return t.stateDeclined;
    default:
      return t.stateClosed;
  }
}

/** Where an order's return stands, shown beside the Delivered status */
export function ReturnStateLine({ request }: Props) {
  const t = useStrings("orders").returns;
  const { tone } = returnState(request);
  const label = stateLabel(request, t);
  const color = TONE_COLORS[tone];
  return (
    <View style={styles.row}>
      <Ionicons name="return-down-back" size={14} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

/** Per order line, the tag for units in the return ("Returning 1"); declined and closed returns tag nothing */
export function returnTags(request: { status: string; remedy?: string | null; items?: { orderItemId: string; quantity: number }[] } | null) {
  const t = strings("orders").returns;
  const verbs: Record<string, string> = { PENDING: t.tagRequested, IN_PROGRESS: t.tagReturning, APPROVED: t.tagReturned };
  const verb = request && (request.status === "APPROVED" && request.remedy === "REPLACE" ? t.tagReplaced : verbs[request.status]);
  if (!request || !verb) return new Map<string, string>();
  return new Map((request.items ?? []).map((i) => [i.orderItemId, t.tag(verb, i.quantity)]));
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: fontSize.sm, fontWeight: "600" },
});
