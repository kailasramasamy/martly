import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StockCheckDepartment } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage, tabular } from "../ui/tokens";
import { CARRY_TONES } from "./CarryHero";
import { PhotoStack } from "./PhotoStack";

export type DepartmentFocus = "carried" | "notCarried";

interface Props {
  department: StockCheckDepartment;
  /** Browsing what's carried or not sold: the card just opens those brands */
  focus?: DepartmentFocus;
  onAll: () => void;
  onSome: () => void;
  onNone: () => void;
}

const n = (v: number) => v.toLocaleString("en-IN");

function Progress({ d }: { d: StockCheckDepartment }) {
  return (
    <View style={styles.track}>
      <View style={{ flex: d.carried, backgroundColor: CARRY_TONES.carried.color }} />
      <View style={{ flex: d.notCarried, backgroundColor: CARRY_TONES.notCarried.color }} />
      <View style={{ flex: d.unchecked }} />
    </View>
  );
}

function meta(d: StockCheckDepartment, focus?: DepartmentFocus) {
  if (focus === "carried") return `${n(d.carried)} carried`;
  if (focus === "notCarried") return `${n(d.notCarried)} not sold`;
  if (d.unchecked === 0) return `All confirmed · ${n(d.carried)} carried · ${n(d.notCarried)} not sold`;
  const hidden = d.suggested > 0 ? ` (${n(d.suggested)} hidden)` : "";
  return `${n(d.unchecked)} to confirm${hidden}${d.carried + d.notCarried > 0 ? ` · ${n(d.carried)} carried` : ""}`;
}

/** A department to confirm in one tap (all carried, or none), or brand by brand */
export function DepartmentCard({ department: d, focus, onAll, onSome, onNone }: Props) {
  const open = d.unchecked > 0 || focus !== undefined;
  return (
    <View style={[styles.card, !open && styles.cardDone]}>
      <TouchableOpacity style={styles.head} onPress={onSome} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${d.name} brands`}>
        <PhotoStack urls={d.sampleImages} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
          <Text style={[styles.meta, tabular]} numberOfLines={1}>{meta(d, focus)}</Text>
          <Progress d={d} />
        </View>
        {open ? <Ionicons name="chevron-forward" size={18} color={manage.muted} /> : <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
      </TouchableOpacity>
      {d.unchecked > 0 && !focus && (
        <View style={styles.actions}>
          <Button label="All" icon="checkmark-done" compact onPress={onAll} style={styles.grow} />
          <Button label="Some" variant="secondary" compact onPress={onSome} style={styles.grow} />
          <Button label="None" variant="danger" compact onPress={onNone} style={styles.grow} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 16, padding: 12, gap: 12 },
  cardDone: { backgroundColor: manage.tint, borderColor: manage.tint },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  track: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: manage.hairline, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
});
