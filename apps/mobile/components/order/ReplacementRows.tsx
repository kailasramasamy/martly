import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { colors, spacing } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useLanguage } from "../../lib/language-context";
import type { ReturnLineSummary, ReturnLinesGroup } from "../../lib/types";
import { replacementNote } from "./replacement-copy";


function ReplacementRow({ line, group }: { line: ReturnLineSummary; group: ReturnLinesGroup }) {
  const t = useStrings("orders").item;
  const { getLocalizedName } = useLanguage();
  const { product, variant } = line.orderItem;
  const image = variant?.imageUrl ?? product.imageUrl ?? product.images?.[0];
  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {image ? <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="contain" /> : <Ionicons name="cube-outline" size={18} color="#94a3b8" />}
      </View>
      <View style={styles.info}>
        <View style={styles.tag}>
          <Ionicons name="refresh" size={11} color="#15803d" />
          <Text style={styles.tagText}>{t.replacement}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>{getLocalizedName(product)}</Text>
        <Text style={styles.variant}>{variant ? `${variant.name} · ` : ""}{t.qty(line.quantity)}</Text>
        <Text style={styles.why}>{replacementNote(group.reason, group.orderId)}</Text>
      </View>
      <View style={styles.price}>
        <Text style={styles.paid}>{"₹"}0</Text>
        <Text style={styles.was}>{t.paidEarlier}</Text>
      </View>
    </View>
  );
}

/** Free replacements that will be added to this order, shown as lines in the order summary */
export function ReplacementRows() {
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const [groups, setGroups] = useState<ReturnLinesGroup[]>([]);

  useEffect(() => {
    if (!storeId) {
      setGroups([]);
      return;
    }
    api.get<ReturnLinesGroup[]>(`/api/v1/return-requests/my-replacements?storeId=${storeId}`)
      .then((res) => setGroups(res.data ?? []))
      .catch(() => setGroups([]));
  }, [storeId]);

  return (
    <>
      {groups.flatMap((g) => g.items.map((line, i) => <ReplacementRow key={`${g.id}-${i}`} line={line} group={g} />))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderTopWidth: 1, borderTopColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#fff", padding: 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  info: { flex: 1, marginLeft: 12, marginRight: 12 },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#dcfce7", marginBottom: 4 },
  tagText: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  variant: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  why: { fontSize: 12, color: "#166534", marginTop: 4 },
  price: { alignItems: "flex-end" },
  paid: { fontSize: 14, fontWeight: "800", color: "#15803d" },
  was: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
