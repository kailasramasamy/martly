import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { ATTENTION_STALE_MINUTES, type AttentionKey } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { SectionCard } from "../ui/SectionCard";
import { manage, tabular } from "../ui/tokens";


interface AttentionItem {
  key: AttentionKey;
  count: number;
  oldestAt: string | null;
}

/** What each kind of waiting work is called and where it's handled */
const KINDS: Record<AttentionKey, { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }> = {
  returns_review: { label: "Returns to review", icon: "return-down-back-outline", href: "/manage/return-requests?status=PENDING" },
  returns_drop: { label: "Returns to receive at store", icon: "storefront-outline", href: "/manage/return-requests?status=IN_PROGRESS" },
  ready_unassigned: { label: "Ready orders without a rider", icon: "bicycle-outline", href: "/(manage)/delivery" },
  counts_approve: { label: "Stock counts to approve", icon: "clipboard-outline", href: "/manage/stock-counts?status=SUBMITTED" },
  recounts: { label: "Recounts requested", icon: "clipboard-outline", href: "/manage/stock-counts?status=RECOUNT" },
  reviews: { label: "Reviews to moderate", icon: "star-outline", href: "/manage/reviews" },
  tickets: { label: "Support tickets open", icon: "chatbubbles-outline", href: "/manage/support-tickets" },
  catalog_drafts: { label: "Catalog drafts to review", icon: "sparkles-outline", href: "/manage/catalog-drafts" },
};

function waited(iso: string): string {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function Row({ item, last, onPress }: { item: AttentionItem; last: boolean; onPress: () => void }) {
  const kind = KINDS[item.key];
  const limit = ATTENTION_STALE_MINUTES[item.key];
  const stale = !!item.oldestAt && limit !== null && Date.now() - new Date(item.oldestAt).getTime() > limit * 60000;
  return (
    <TouchableOpacity style={[styles.row, !last && styles.divider]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${kind.label}: ${item.count}`}>
      <View style={[styles.icon, stale && styles.iconStale]}>
        <Ionicons name={kind.icon} size={20} color={stale ? manage.attentionText : colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{kind.label}</Text>
        {item.oldestAt ? <Text style={[styles.age, stale && styles.ageStale]}>Oldest waiting {waited(item.oldestAt)}</Text> : null}
      </View>
      <View style={[styles.count, stale && styles.countStale]}>
        <Text style={[styles.countText, tabular, stale && styles.countTextStale]}>{item.count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={manage.muted} />
    </TouchableOpacity>
  );
}

/** Today's to-do list for the manager: everything waiting on someone with their permissions, oldest flagged */
export function AttentionCard({ storeId }: { storeId: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const load = useCallback(() => {
    api.get<AttentionItem[]>(`/api/v1/dashboard/attention${storeId ? `?storeId=${storeId}` : ""}`)
      .then((res) => setItems(res.data ?? []))
      .catch(() => setItems(null));
  }, [storeId]);
  // Runs on mount and every time Today comes back into view; pull-to-refresh remounts the card
  useFocusEffect(load);
  if (!items) return null;

  const total = items.reduce((n, i) => n + i.count, 0);
  if (total === 0) {
    return (
      <View style={styles.clear}>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={styles.clearText}>All caught up. Nothing waiting on you.</Text>
      </View>
    );
  }
  return (
    <SectionCard title={`Needs your attention · ${total}`} flush>
      {items.map((item, i) => <Row key={item.key} item={item} last={i === items.length - 1} onPress={() => router.push(KINDS[item.key].href)} />)}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: manage.hairline },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: manage.tint },
  iconStale: { backgroundColor: manage.attentionBg },
  text: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  age: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  ageStale: { color: manage.attentionText, fontFamily: fonts.semibold },
  count: { minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: manage.tint },
  countStale: { backgroundColor: colors.accent },
  countText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
  countTextStale: { color: manage.attentionText },
  clear: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  clearText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
});
