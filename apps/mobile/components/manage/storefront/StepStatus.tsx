import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { StorefrontCheckMeta } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { manage, tabular } from "../ui/tokens";
import { Button } from "../ui/Button";
import { promotionsLeft } from "../marketing/use-entitlements";
import type { Entitlements } from "../marketing/plan-types";
import { CHECK_STATUS, useBilingual } from "./storefront";

const PLAN_HREF = "/manage/marketing-plan";
const COST: Record<NonNullable<StorefrontCheckMeta["uses"]>, string> = {
  PROMOTION: "Setting this up uses 1 promotion from your plan.",
  AI_IMAGES: "An AI-made banner uses 1 AI image from your plan.",
};
const NOT_COUNTED: Record<StorefrontCheckResult["status"], string> = {
  ON: "On", PARTIAL: "Started", STALE: "Was on, has lapsed", OFF: "Not set up yet", NA: "Not needed",
};

/** What a setup step would spend from the plan, or null when it's free or the plan isn't known */
export function allowanceLeft(meta: StorefrontCheckMeta, plan: Entitlements | null) {
  if (!meta.uses || !plan) return null;
  return meta.uses === "PROMOTION" ? promotionsLeft(plan) : plan.aiImages.left;
}

/** A promotion-backed step can't be done at all with no promotions left; AI images are only for the optional AI banner */
export const blockedByPlan = (meta: StorefrontCheckMeta, plan: Entitlements | null) => meta.uses === "PROMOTION" && allowanceLeft(meta, plan) === 0;

function useStatusLine(check: StorefrontCheckResult, meta: StorefrontCheckMeta) {
  const text = useBilingual();
  const { language } = useLanguage();
  if (check.underperforming) return "Live, but shoppers aren't tapping it";
  if (check.have === undefined || check.need === undefined || !meta.unit) return NOT_COUNTED[check.status];
  const unit = text(meta.unit);
  if (check.have >= check.need) return `${check.have} ${unit}`;
  return language === "ta" ? `${check.have}/${check.need} ${unit}` : `${check.have} of ${check.need} ${unit}`;
}

function PlanNudge({ plan }: { plan: Entitlements }) {
  const router = useRouter();
  const label = plan.trial.available ? "Try Growth free for 14 days" : plan.onPaidPlan ? "Buy more or upgrade" : "See plans";
  return (
    <View style={styles.nudge}>
      <Text style={styles.nudgeText}>
        {plan.onPaidPlan ? "You've used this month's allowance." : "Your free plan doesn't include this."}
      </Text>
      <Button label={label} icon="rocket-outline" variant="secondary" compact onPress={() => router.push(PLAN_HREF)} />
    </View>
  );
}

/** Where the store stands on this step now, and what setting it up spends from the marketing plan */
export function StepStatus({ check, meta, plan }: { check: StorefrontCheckResult; meta: StorefrontCheckMeta; plan: Entitlements | null }) {
  const line = useStatusLine(check, meta);
  const left = allowanceLeft(meta, plan);
  const counted = check.have !== undefined && check.need !== undefined && check.need > 0;
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Your store now</Text>
      <Text style={[styles.line, { color: CHECK_STATUS[check.status].color }]}>{line}</Text>
      {counted && (
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, ((check.have ?? 0) / (check.need ?? 1)) * 100)}%` }]} /></View>
      )}
      {meta.uses && plan && left !== null && (
        <View style={styles.plan}>
          <Text style={styles.cost}>{COST[meta.uses]}</Text>
          <Text style={[styles.left, tabular, left === 0 && styles.out]}>
            {`${plan.plan?.name ?? "Free plan"}: ${left} ${meta.uses === "PROMOTION" ? "promotions" : "AI images"} left this month`}
          </Text>
          {left === 0 && <PlanNudge plan={plan} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: manage.canvas, borderRadius: radius.lg, padding: 12, marginTop: 14, gap: 6 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: manage.muted },
  line: { fontFamily: fonts.extrabold, fontSize: 16 },
  track: { height: 6, borderRadius: 3, backgroundColor: manage.line, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  plan: { borderTopWidth: 1, borderTopColor: manage.line, paddingTop: 8, marginTop: 4, gap: 4 },
  cost: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  left: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  out: { color: manage.attentionText },
  nudge: { backgroundColor: manage.attentionBg, borderRadius: radius.md, padding: 10, gap: 8, marginTop: 4 },
  nudgeText: { fontFamily: fonts.semibold, fontSize: 13, color: manage.attentionText },
});
