import { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { BottomSheet } from "../search/BottomSheet";
import { rupees } from "../orders/format";
import type { ReorderItems } from "../orders/types";

type Line = ReorderItems["items"][number];

function Stepper({ qty, max, onChange }: { qty: number; max: number; onChange: (n: number) => void }) {
  const t = useStrings("orders").reorder;
  const step = (icon: "remove" | "add", next: number, label: string, disabled: boolean) => (
    <TouchableOpacity style={styles.step} onPress={() => onChange(next)} disabled={disabled} accessibilityLabel={label} hitSlop={{ top: 8, bottom: 8 }}>
      <Ionicons name={icon} size={18} color={disabled ? "#cbd5e1" : colors.primary} />
    </TouchableOpacity>
  );
  return (
    <View style={styles.stepper}>
      {step("remove", qty - 1, t.fewer, qty <= 1)}
      <Text style={styles.qty}>{qty}</Text>
      {step("add", qty + 1, t.more, qty >= max)}
    </View>
  );
}

interface ChoiceProps {
  line: Line;
  picked: boolean;
  qty: number;
  onToggle: () => void;
  onQty: (n: number) => void;
}

function Choice({ line, picked, qty, onToggle, onQty }: ChoiceProps) {
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  const sp = line.storeProduct;
  const image = sp.variant.imageUrl ?? sp.product.imageUrl;
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: picked }}>
      <Ionicons name={picked ? "checkbox" : "square-outline"} size={24} color={picked ? colors.primary : "#94a3b8"} />
      <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : <Ionicons name="cube-outline" size={18} color="#94a3b8" />}</View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{getLocalizedName(sp.product)}</Text>
        <Text style={styles.meta}>{sp.variant.name} · {rupees(getBestPrice(sp, isMember))}</Text>
      </View>
      <Stepper qty={qty} max={sp.stock > 0 ? sp.stock : qty} onChange={onQty} />
    </TouchableOpacity>
  );
}

/** Pick which of a past order's items go back in the cart; items no longer sold show greyed out */
export function BuyAgainSheet({ choices, onAdd, onClose }: { choices: ReorderItems | null; onAdd: (picked: Line[]) => void; onClose: () => void }) {
  const t = useStrings("orders").reorder;
  const { isMember } = useMembership();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Quantities start at what was ordered last time
  const [qtys, setQtys] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    setPicked(new Set());
    setQtys(new Map(choices?.items.map((l) => [l.storeProduct.id, l.quantity])));
  }, [choices]);

  const lines = choices?.items ?? [];
  const chosen = lines.filter((l) => picked.has(l.storeProduct.id)).map((l) => ({ ...l, quantity: qtys.get(l.storeProduct.id) ?? l.quantity }));
  const total = chosen.reduce((n, l) => n + getBestPrice(l.storeProduct, isMember) * l.quantity, 0);
  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  // Changing a quantity means the shopper wants the item
  const setQty = (id: string, n: number) => {
    setQtys((prev) => new Map(prev).set(id, n));
    setPicked((prev) => new Set(prev).add(id));
  };

  const footer = (
    <TouchableOpacity style={[styles.add, chosen.length === 0 && styles.addDisabled]} disabled={chosen.length === 0} onPress={() => onAdd(chosen)} activeOpacity={0.8}>
      <Text style={styles.addText}>{chosen.length ? t.addPicked(chosen.length, rupees(total)) : t.pickHint}</Text>
    </TouchableOpacity>
  );
  return (
    <BottomSheet visible={choices !== null} title={t.button} onClose={onClose} footer={footer} scrollable>
      {lines.map((line) => {
        const id = line.storeProduct.id;
        return <Choice key={id} line={line} picked={picked.has(id)} qty={qtys.get(id) ?? line.quantity} onToggle={() => toggle(id)} onQty={(n) => setQty(id, n)} />;
      })}
      {choices?.unavailable.map((u) => (
        <View key={`${u.productName}-${u.variantName}`} style={[styles.row, styles.unavailable]}>
          <Ionicons name="remove-circle-outline" size={24} color="#cbd5e1" />
          <View style={styles.info}>
            <Text style={[styles.name, styles.muted]} numberOfLines={2}>{u.productName}</Text>
            <Text style={styles.meta}>{u.variantName} · {t.notAvailable}</Text>
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, minHeight: 64, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  unavailable: { opacity: 0.7 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 38, height: 38, resizeMode: "contain" },
  info: { flex: 1 },
  name: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  muted: { color: colors.textSecondary },
  meta: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.primary, borderRadius: 18, height: 36 },
  step: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 22, textAlign: "center", fontSize: 15, fontFamily: fonts.bold, color: colors.primary, fontVariant: ["tabular-nums"] },
  add: { backgroundColor: colors.accent, borderRadius: 24, minHeight: 48, alignItems: "center", justifyContent: "center" },
  addDisabled: { backgroundColor: "#fde68a" },
  addText: { fontSize: 15, fontFamily: fonts.bold, color: colors.accentText },
});
