import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { STOREFRONT_CHECKS, STOREFRONT_GROUPS, STOREFRONT_GROUP_LABELS } from "@martly/shared/constants";
import type { StorefrontCheckResult, StorefrontHealth } from "@martly/shared/types";
import { fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { SectionCard } from "../ui/SectionCard";
import { Sparkline } from "../ui/Sparkline";
import { AmberButton } from "./AmberButton";
import { Awning } from "./Awning";
import { CheckRow } from "./CheckRow";
import { setupHref, useBilingual } from "./storefront";

// A trend reads as one only with about a week of daily scores
const MIN_TREND_DAYS = 7;

function Summary({ health, onGuide }: { health: StorefrontHealth; onGuide: () => void }) {
  const done = health.checks.filter((c) => c.status === "ON").length;
  const applies = health.checks.filter((c) => c.status !== "NA").length;
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <View style={styles.flex}>
          <Text style={[styles.score, tabular]}>{health.score}<Text style={styles.outOf}>/100</Text></Text>
          <Text style={styles.sub}>{`${done} of ${applies} features on`}</Text>
        </View>
        {health.trend.length >= MIN_TREND_DAYS && <View style={styles.trend}><Sparkline values={health.trend.map((t) => t.score)} color={manage.live} /></View>}
      </View>
      <Awning groups={health.groups} />
      {health.suggestions.length > 0 && <AmberButton label={`Walk me through ${health.suggestions.length} steps`} onPress={onGuide} />}
    </View>
  );
}

/** Every check by area, so the owner sees what's on, what's missing and what each one does */
export function HealthTab({ health, storeId }: { health: StorefrontHealth; storeId: string }) {
  const router = useRouter();
  const text = useBilingual();
  const suggested = new Set(health.suggestions.map((s) => s.key));
  const guide = (start?: string) => router.push({ pathname: "/manage/storefront/guide", params: { storeId, ...(start && { start }) } });
  const tap = (c: StorefrontCheckResult) => {
    if (c.status === "NA") return undefined;
    return suggested.has(c.key) ? () => guide(c.key) : () => router.push(setupHref(c.key, storeId));
  };
  return (
    <>
      <Summary health={health} onGuide={() => guide()} />
      {STOREFRONT_GROUPS.map((g) => {
        const checks = health.checks.filter((c) => STOREFRONT_CHECKS[c.key].group === g);
        const score = health.groups[g];
        return (
          <SectionCard key={g} title={`${text(STOREFRONT_GROUP_LABELS[g])}${score === null ? "" : ` · ${score}`}`} flush>
            {checks.map((c) => <CheckRow key={c.key} check={c} onPress={tap(c)} />)}
          </SectionCard>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: manage.ink, borderRadius: radius.xl, padding: 16, gap: 14 },
  summaryHead: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  flex: { flex: 1 },
  score: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 50, color: "#fff" },
  outOf: { fontFamily: fonts.bold, fontSize: 16, color: manage.inkMuted },
  sub: { fontFamily: fonts.semibold, fontSize: 13, color: manage.inkMuted },
  trend: { width: 110 },
});
