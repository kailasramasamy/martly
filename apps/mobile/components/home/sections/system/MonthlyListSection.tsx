import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors, fonts } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import { formatDate } from "../../../../lib/i18n/format";

interface Teaser { listId: string; month: string; itemCount: number; total: number; changed: number; toCheck: number }

/** A one-row strip while the monthly list is due: tap it to check the list, or order it as is */
export const MonthlyListSection = memo(function MonthlyListSection({ section }: { section: SystemSection }) {
  const t = useStrings("monthlyList");
  const { month, itemCount, total, changed, toCheck } = section.data as unknown as Teaser;
  const [y, m] = month.split("-").map(Number);
  const monthName = formatDate(new Date(y, m - 1, 1), { month: "long" });
  const flagged = Math.max(changed, toCheck);
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.strip} onPress={() => router.push("/monthly-list")} activeOpacity={0.85} accessibilityRole="button">
        <View style={styles.icon}><Ionicons name="reader-outline" size={22} color={colors.primary} /></View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={2}>{t.stripTitle(monthName)}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {t.stripMeta(itemCount, total.toLocaleString("en-IN"))}
            {flagged > 0 && <Text style={styles.flag}>{` · ${t.changedCount(flagged)}`}</Text>}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.order} onPress={() => router.push({ pathname: "/monthly-list", params: { order: "1" } })}
          hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="button"
        >
          <Text style={styles.orderText}>{t.orderShort}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 16 },
  strip: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingLeft: 12, paddingRight: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#ffffff" },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  flag: { fontFamily: fonts.bold, color: "#b45309" },
  order: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  orderText: { fontFamily: fonts.extrabold, fontSize: 13, color: "#ffffff" },
});
