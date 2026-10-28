import { useCallback, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import type { AttentionKey } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { manage, tabular } from "../ui/tokens";

const TASKS: Partial<Record<AttentionKey, { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }>> = {
  stock_check: { label: "Confirm products", icon: "checkbox-outline", href: "/manage/stock-check" },
  price_review: { label: "Check prices", icon: "pricetags-outline", href: "/manage/price-review" },
};

/** Onboarding checks still open at this store; gone once both are done (they stay under More for re-runs) */
export function SetupTasks({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<{ key: AttentionKey; count: number }[]>([]);
  const load = useCallback(() => {
    // The attention endpoint only returns kinds the user has permission to act on
    api.get<{ key: AttentionKey; count: number }[]>(`/api/v1/dashboard/attention?storeId=${storeId}`)
      .then((res) => setItems((res.data ?? []).filter((i) => TASKS[i.key] && i.count > 0)))
      .catch(() => setItems([]));
  }, [storeId]);
  useFocusEffect(load);
  if (items.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Finish setting up</Text>
      <View style={styles.row}>
        {items.map((item) => {
          const task = TASKS[item.key]!;
          return (
            <TouchableOpacity key={item.key} style={styles.tile} onPress={() => router.push(task.href)} accessibilityRole="button"
              accessibilityLabel={`${task.label}: ${item.count} left`} activeOpacity={0.75}>
              <Ionicons name={task.icon} size={18} color={colors.primary} />
              <Text style={styles.label} numberOfLines={1}>{task.label}</Text>
              <Text style={[styles.left, tabular]}>{item.count.toLocaleString("en-IN")} left</Text>
              <Ionicons name="chevron-forward" size={14} color={manage.muted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 14 },
  title: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 10 },
  row: { gap: 8 },
  tile: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 12,
    borderRadius: radius.md, backgroundColor: manage.tint,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  left: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
