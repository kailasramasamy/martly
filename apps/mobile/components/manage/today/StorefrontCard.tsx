import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { STOREFRONT_CHECKS } from "@martly/shared/constants";
import type { StorefrontHealth } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { AmberButton } from "../storefront/AmberButton";
import { Awning } from "../storefront/Awning";
import { useBilingual, useStorefrontHealth } from "../storefront/storefront";

const TOP = 3;

// Score change against the oldest day in the last week of the trend
function weekChange(trend: StorefrontHealth["trend"]) {
  if (trend.length < 2) return null;
  const week = trend.slice(-8);
  return week[week.length - 1].score - week[0].score;
}

/** Today's look at how rich the store's app is: the score, its awning, and the next three things to do */
export function StorefrontCard({ storeId }: { storeId: string }) {
  const router = useRouter();
  const text = useBilingual();
  const { data } = useStorefrontHealth(storeId);
  if (!data) return null;
  const change = weekChange(data.trend);
  const open = () => router.push({ pathname: "/manage/storefront", params: { storeId } });
  const guide = (start?: string) => router.push({ pathname: "/manage/storefront/guide", params: { storeId, ...(start && { start }) } });

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={open} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Storefront score ${data.score} out of 100`}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>YOUR STOREFRONT</Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, tabular]}>{data.score}</Text>
              <Text style={styles.outOf}>/100</Text>
              {change ? <Text style={[styles.change, change < 0 && styles.down]}>{`${change > 0 ? "+" : ""}${change} this week`}</Text> : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={manage.inkMuted} />
        </View>
        <Awning groups={data.groups} />
      </TouchableOpacity>
      {data.suggestions.slice(0, TOP).map((s) => (
        <TouchableOpacity key={s.key} style={styles.next} onPress={() => guide(s.key)} activeOpacity={0.8} accessibilityRole="button">
          <View style={styles.flex}>
            <Text style={styles.nextTitle} numberOfLines={1}>{text(STOREFRONT_CHECKS[s.key].title)}</Text>
            <Text style={styles.nextWhy} numberOfLines={1}>{text(STOREFRONT_CHECKS[s.key].why)}</Text>
          </View>
          <Text style={[styles.gain, tabular]}>{`+${s.gain}`}</Text>
        </TouchableOpacity>
      ))}
      {data.suggestions.length > 0 && <AmberButton label="Walk me through it" onPress={() => guide()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.ink, borderRadius: radius.xl, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  score: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, color: "#fff" },
  outOf: { fontFamily: fonts.bold, fontSize: 15, color: manage.inkMuted },
  change: { fontFamily: fonts.bold, fontSize: 12.5, color: manage.live, marginLeft: 8 },
  down: { color: "#fca5a5" },
  next: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48,
    backgroundColor: manage.inkRaised, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8,
  },
  nextTitle: { fontFamily: fonts.bold, fontSize: 14, color: manage.inkText },
  nextWhy: { fontFamily: fonts.medium, fontSize: 12, color: manage.inkMuted, marginTop: 1 },
  gain: { fontFamily: fonts.extrabold, fontSize: 15, color: manage.live },
});
