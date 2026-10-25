import { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { StoreWalkDepartment } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { WalkRoute } from "../../lib/types";
import { walkMinutes } from "../../lib/walk-session";
import { useEntrance } from "./motion";
import { useReduceMotion } from "../../lib/use-reduce-motion";

const OTHERS = 3;

/** A check mark that pops in */
export function DoneMark() {
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!reduce) Animated.spring(pop, { toValue: 1, stiffness: 180, damping: 10, useNativeDriver: true }).start();
  }, [pop, reduce]);
  return (
    <Animated.View style={[styles.mark, { opacity: pop, transform: [{ scale: pop }] }]}>
      <Ionicons name="checkmark" size={32} color="#ffffff" />
    </Animated.View>
  );
}

// Departments not walked yet: the one with most due items first, else the next on the shelves
function upNext(route: WalkRoute, walked: string[]) {
  const at = route.departments.findIndex((d) => d.id === route.departmentId);
  const ahead = [...route.departments.slice(at + 1), ...route.departments.slice(0, at)].filter((d) => !walked.includes(d.id));
  const next = [...ahead].sort((a, b) => b.dueCount - a.dueCount)[0];
  return { next, others: ahead.filter((d) => d !== next).slice(0, OTHERS) };
}

function Other({ department, delay, onPress }: { department: StoreWalkDepartment; delay: number; onPress: () => void }) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const entrance = useEntrance(delay);
  return (
    <Animated.View style={entrance}>
      <TouchableOpacity style={styles.other} onPress={onPress} accessibilityRole="button">
        <View style={styles.otherText}>
          <Text style={styles.otherName}>{getLocalizedName(department)}</Text>
          <Text style={styles.otherMeta}>{t.aisles(department.aisleCount)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    </Animated.View>
  );
}

interface Props { route: WalkRoute; walked: string[]; onWalk: (departmentId: string) => void; onFinish: () => void; forList: boolean }

/** A department walked: what's in the bag, then the next department to walk (most due items first) or finish */
export function NextDepartmentCard({ route, walked, onWalk, onFinish, forList }: Props) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  const { itemCount, totalAmount } = useCart();
  const done = route.departments.find((d) => d.id === route.departmentId)!;
  const { next, others } = upNext(route, walked);
  const nextCard = useEntrance(380);
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <DoneMark />
          <Text style={styles.heroTitle}>{t.departmentDone(getLocalizedName(done))}</Text>
          <Text style={styles.heroStats}>{(forList ? t.listDoneStats : t.departmentDoneStats)(route.stops.length, itemCount, Math.round(totalAmount).toLocaleString("en-IN"))}</Text>
        </View>
        {next && (
          <Animated.View style={[styles.next, nextCard]}>
            <Text style={styles.kicker}>{t.keepWalking}</Text>
            <View style={styles.nextHead}>
              <Text style={styles.nextName}>{getLocalizedName(next)}</Text>
              {next.dueCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{t.dueBadge(next.dueCount)}</Text></View>}
            </View>
            <Text style={styles.nextMeta}>
              {t.aisles(next.aisleCount)} · {t.minutes(walkMinutes(next.aisleCount))}{next.dueCount > 0 ? ` · ${t.dueThere(next.dueCount)}` : ""}
            </Text>
            <TouchableOpacity style={styles.walk} onPress={() => onWalk(next.id)} accessibilityRole="button">
              <Text style={styles.walkText}>{t.walkDepartment(getLocalizedName(next))}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} />
            </TouchableOpacity>
          </Animated.View>
        )}
        {others.length > 0 && <Text style={styles.othersTitle}>{t.anotherDepartment}</Text>}
        {others.map((d, i) => <Other key={d.id} department={d} delay={480 + i * 70} onPress={() => onWalk(d.id)} />)}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.finish} onPress={onFinish} accessibilityRole="button">
          <Text style={styles.finishText}>{forList ? t.backToList : t.imDone}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, gap: 10 },
  hero: { alignItems: "center", gap: 8, paddingVertical: 20 },
  mark: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.text, textAlign: "center" },
  heroStats: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  next: { borderRadius: 16, backgroundColor: colors.primaryDark, padding: 16, gap: 6 },
  kicker: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: "#99f6e4" },
  nextHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextName: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 19, color: "#ffffff" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.salePill },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.salePillText },
  nextMeta: { fontFamily: fonts.semibold, fontSize: 13, color: "#ccfbf1" },
  walk: { marginTop: 8, height: 46, borderRadius: 12, backgroundColor: "#ffffff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  walkText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primaryDark },
  othersTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  other: {
    minHeight: 56, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, flexDirection: "row", alignItems: "center",
  },
  otherText: { flex: 1, gap: 1 },
  otherName: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  otherMeta: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  footer: { paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  finish: { height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  finishText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },
});
