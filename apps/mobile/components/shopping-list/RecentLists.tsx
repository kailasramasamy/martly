import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecentList } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { friendlyTime } from "../orders/format";
import { BottomSheet } from "../search/BottomSheet";

const PREVIEW = 3;

type Actions = {
  /** Straight to finding products for the picked items (the build logs the list, so it stays in Recent lists) */
  onFind: (texts: string[]) => void;
  /** Onto My list instead, to refine before shopping */
  onAdd: (texts: string[]) => void;
};

/** A past list's items, all ticked; the shopper unticks what they don't need, then finds them or adds them to My list */
function PickSheet({ list, onFind, onAdd, onClose }: Actions & { list: RecentList | null; onClose: () => void }) {
  const t = useStrings("shoppingList");
  const [kept, setKept] = useState<Set<number>>(new Set());
  useEffect(() => setKept(new Set(list?.items.map((_, i) => i))), [list]);
  const toggle = (i: number) => setKept((prev) => {
    const next = new Set(prev);
    if (!next.delete(i)) next.add(i);
    return next;
  });
  const picked = list?.items.filter((_, i) => kept.has(i)) ?? [];
  const none = picked.length === 0;
  const footer = (
    <View style={styles.footer}>
      <TouchableOpacity style={[styles.find, none && styles.findOff]} disabled={none} onPress={() => onFind(picked)} activeOpacity={0.85}>
        <Ionicons name="basket" size={20} color="#ffffff" />
        <Text style={styles.findText}>{t.findProducts(picked.length)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.instead} disabled={none} onPress={() => onAdd(picked)}>
        <Text style={[styles.insteadText, none && styles.insteadOff]}>{t.addInstead}</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <BottomSheet visible={list !== null} title={list ? friendlyTime(list.createdAt) : ""} onClose={onClose} footer={footer} scrollable>
      <Text style={styles.sheetHint}>{t.pickItems}</Text>
      {list?.items.map((item, i) => (
        <TouchableOpacity key={i} style={styles.pickRow} onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityState={{ checked: kept.has(i) }}>
          <Ionicons name={kept.has(i) ? "checkbox" : "square-outline"} size={24} color={kept.has(i) ? colors.primary : "#94a3b8"} />
          <Text style={[styles.pickText, !kept.has(i) && styles.pickOff]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </BottomSheet>
  );
}

function ListCard({ list, onPress }: { list: RecentList; onPress: () => void }) {
  const t = useStrings("shoppingList");
  const { getLocalizedName } = useLanguage();
  const rest = list.items.length - PREVIEW;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <View style={styles.cardIcon}>
        <Ionicons name="receipt-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{friendlyTime(list.createdAt)} · {t.itemCount(list.items.length)}</Text>
        <Text style={styles.cardStore} numberOfLines={1}>{getLocalizedName(list.store)}</Text>
        <Text style={styles.cardPreview} numberOfLines={2}>
          {list.items.slice(0, PREVIEW).join(", ")}{rest > 0 ? `, ${t.more(rest)}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );
}

/** Lists from earlier shops: pick one, keep what's needed this time, and find its products (or refine it on My list first) */
export function RecentLists({ lists, onFind, onAdd }: Actions & { lists: RecentList[] }) {
  const t = useStrings("shoppingList");
  const [open, setOpen] = useState<RecentList | null>(null);
  if (lists.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t.recentLists}</Text>
      <Text style={styles.hint}>{t.recentHint}</Text>
      {lists.map((list) => <ListCard key={list.id} list={list} onPress={() => setOpen(list)} />)}
      <PickSheet
        list={open} onClose={() => setOpen(null)}
        onFind={(texts) => { setOpen(null); onFind(texts); }} onAdd={(texts) => { setOpen(null); onAdd(texts); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, gap: 10 },
  heading: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  hint: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: -6 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 72, backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ccfbf1", alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  cardStore: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textSecondary },
  cardPreview: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.text },
  sheetHint: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.textSecondary, marginBottom: 6 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  pickText: { flex: 1, fontSize: 16, fontFamily: fonts.medium, color: colors.text },
  pickOff: { color: "#94a3b8", textDecorationLine: "line-through" },
  footer: { gap: 4 },
  find: { flexDirection: "row", gap: 8, backgroundColor: colors.primary, borderRadius: 26, minHeight: 52, alignItems: "center", justifyContent: "center" },
  findOff: { backgroundColor: "#99f6e4" },
  findText: { fontSize: 16, fontFamily: fonts.bold, color: "#ffffff" },
  instead: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  insteadText: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.primary },
  insteadOff: { color: "#94a3b8" },
});
