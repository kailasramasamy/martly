import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RefuseReasonLabels, type RefuseReason } from "@martly/shared/constants";
import { colors, fonts } from "../../../../constants/theme";
import { formatINR, manage, tabular } from "../../ui/tokens";
import type { OrderDetailItem } from "../../orders/types";

export type RefusedState = Record<string, { quantity: number; reason: RefuseReason | null }>;
type LineChange = { quantity?: number; reason?: RefuseReason };

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.step} disabled={value <= 1} onPress={() => onChange(value - 1)} accessibilityLabel="One less not taken">
        <Ionicons name="remove" size={22} color={value <= 1 ? manage.muted : colors.text} />
      </TouchableOpacity>
      <Text style={[styles.count, tabular]}>{value}</Text>
      <TouchableOpacity style={styles.step} disabled={value >= max} onPress={() => onChange(value + 1)} accessibilityLabel="One more not taken">
        <Ionicons name="add" size={22} color={value >= max ? manage.muted : colors.text} />
      </TouchableOpacity>
    </View>
  );
}

function Reasons({ value, onChange }: { value: RefuseReason | null; onChange: (r: RefuseReason) => void }) {
  return (
    <View style={styles.chips}>
      {(Object.keys(RefuseReasonLabels) as RefuseReason[]).map((r) => (
        <TouchableOpacity key={r} style={[styles.chip, r === value && styles.chipOn]} onPress={() => onChange(r)} accessibilityRole="radio" accessibilityState={{ selected: r === value }}>
          <Text style={[styles.chipText, r === value && styles.chipTextOn]}>{RefuseReasonLabels[r]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** What the customer isn't taking from this line: how many and why */
function NotTaking({ item, quantity, reason, onChange }: { item: OrderDetailItem; quantity: number; reason: RefuseReason | null; onChange: (next: LineChange) => void }) {
  return (
    <View style={styles.refuse}>
      <View style={styles.refuseRow}>
        <Text style={styles.refuseLabel}>Not taking</Text>
        {item.quantity > 1 ? <Stepper value={quantity} max={item.quantity} onChange={(q) => onChange({ quantity: q })} /> : null}
        <TouchableOpacity onPress={() => onChange({ quantity: 0 })} style={styles.undo} accessibilityRole="button">
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.why}>Why?</Text>
      <Reasons value={reason} onChange={(r) => onChange({ reason: r })} />
    </View>
  );
}

function ItemRow({ item, line, onChange }: { item: OrderDetailItem; line: { quantity: number; reason: RefuseReason | null }; onChange: (next: LineChange) => void }) {
  const image = item.variant.imageUrl ?? item.product.imageUrl ?? item.product.images[0];
  const refusing = line.quantity > 0;
  return (
    <View style={[styles.item, refusing && styles.itemRefusing]}>
      <View style={styles.itemRow}>
        <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="contain" /> : <Ionicons name="cube-outline" size={22} color={manage.muted} />}</View>
        <View style={styles.itemText}>
          <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
          <Text style={styles.variant}>{item.variant.name} · {formatINR(Number(item.unitPrice))} each</Text>
        </View>
        <Text style={[styles.qty, tabular]}>× {item.quantity}</Text>
      </View>
      {refusing
        ? <NotTaking item={item} quantity={line.quantity} reason={line.reason} onChange={onChange} />
        : (
          <TouchableOpacity style={styles.refuseLink} onPress={() => onChange({ quantity: 1 })} accessibilityRole="button">
            <Ionicons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={styles.refuseLinkText}>Customer not taking this?</Text>
          </TouchableOpacity>
        )}
    </View>
  );
}

/** Step 1: every item in the order, each with a way to record that the customer didn't take it */
export function HandoverList({ items, refused, onChange }: { items: OrderDetailItem[]; refused: RefusedState; onChange: (itemId: string, next: LineChange) => void }) {
  return (
    <>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} line={refused[item.id] ?? { quantity: 0, reason: null }} onChange={(next) => onChange(item.id, next)} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  item: { padding: 12, gap: 10, borderRadius: 14, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  itemRefusing: { borderColor: "#fca5a5", backgroundColor: "#fff7f7" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: manage.hairline, overflow: "hidden" },
  thumbImage: { width: "88%", height: "88%" },
  itemText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  variant: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  qty: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  refuseLink: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  refuseLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.error },
  refuse: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#fecaca" },
  refuseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  refuseLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.error },
  undo: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  undoText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  why: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 22, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff" },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 22, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.error, borderColor: colors.error },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chipTextOn: { color: "#fff", fontFamily: fonts.bold },
});
