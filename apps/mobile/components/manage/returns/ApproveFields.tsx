import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ReturnMethodLabels, ReturnRemedyLabels, type ReturnMethod, type ReturnRemedy } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";
import { formatINR, manage } from "../ui/tokens";
import type { ReturnRequestDetail } from "./types";

function Choice<V extends string>({ label, options, value, onChange }: { label: string; options: Record<V, string>; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {(Object.keys(options) as V[]).map((key) => {
          const on = key === value;
          return (
            <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(key)} activeOpacity={0.75} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{options[key]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface OutcomeProps {
  remedy: ReturnRemedy;
  method: ReturnMethod;
  keepHint: string | null;
  onRemedy: (r: ReturnRemedy) => void;
  onMethod: (m: ReturnMethod) => void;
}

export function OutcomeChoices({ remedy, method, keepHint, onRemedy, onMethod }: OutcomeProps) {
  return (
    <>
      <Choice label="Outcome" options={ReturnRemedyLabels} value={remedy} onChange={onRemedy} />
      <Choice label="Return method" options={ReturnMethodLabels} value={method} onChange={onMethod} />
      {keepHint ? <Text style={styles.hint}>{keepHint}</Text> : null}
    </>
  );
}

interface RestockProps {
  items: ReturnRequestDetail["items"];
  restock: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
}

export function RestockToggles({ items, restock, onToggle }: RestockProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Put back in stock</Text>
      {items.map((i) => (
        <SwitchRow key={i.id} label={`${i.quantity} × ${i.orderItem.product.name}`} description={i.orderItem.variant.name} value={!!restock[i.id]} onValueChange={(on) => onToggle(i.id, on)} />
      ))}
    </View>
  );
}

export function RefundField({ amount, requested, error, onChange }: { amount: string; requested: number; error?: string; onChange: (v: string) => void }) {
  return (
    <TextField
      label="Refund amount"
      prefix={"₹"}
      keyboardType="decimal-pad"
      value={amount}
      onChangeText={onChange}
      error={error}
      hint={`Requested ${formatINR(requested)}. Lower it for a partial refund; it is credited to the customer's wallet.`}
    />
  );
}

export function nextStepText(remedy: ReturnRemedy, method: ReturnMethod): string {
  if (method === "KEEP") return remedy === "REFUND" ? "The refund is paid now. The customer keeps the item." : "A free replacement is added to the customer's next order.";
  const back = method === "NEXT_ORDER" ? "The rider collects the item with the customer's next order." : "The customer drops the item at the store.";
  return remedy === "REFUND" ? `${back} The refund is paid when the item is back with the store.` : `${back} A free replacement goes out on the customer's next order.`;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chipTextOn: { color: "#fff", fontFamily: fonts.bold },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
});
