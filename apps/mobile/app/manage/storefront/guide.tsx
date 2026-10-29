import { useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { STOREFRONT_CHECKS, STOREFRONT_GROUP_LABELS, type StorefrontCheckKey } from "@martly/shared/constants";
import type { StorefrontHealth, StorefrontSuggestion } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { manage, tabular } from "../../../components/manage/ui/tokens";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { useEntitlements } from "../../../components/manage/marketing/use-entitlements";
import type { Entitlements } from "../../../components/manage/marketing/plan-types";
import { StepStatus, blockedByPlan } from "../../../components/manage/storefront/StepStatus";
import { HeroCardList } from "../../../components/manage/storefront/HeroCardList";
import { CHECK_PREVIEWS } from "../../../components/manage/storefront/previews";
import { EVIDENCE, aiHref, setupHref, useBilingual, useStorefrontHealth } from "../../../components/manage/storefront/storefront";

// Suggestions still to do, the one the owner tapped first; done ones drop out as health refreshes on return
function remaining(health: StorefrontHealth | null, skipped: Set<string>, start?: string) {
  const left = (health?.suggestions ?? []).filter((s) => !skipped.has(s.key));
  const first = left.findIndex((s) => s.key === start);
  return first > 0 ? [left[first], ...left.slice(0, first), ...left.slice(first + 1)] : left;
}

function Step({ health, step, plan }: { health: StorefrontHealth; step: StorefrontSuggestion; plan: Entitlements | null }) {
  const text = useBilingual();
  const meta = STOREFRONT_CHECKS[step.key];
  const check = health.checks.find((c) => c.key === step.key);
  const evidence = step.evidence ? EVIDENCE[step.evidence] : null;
  const preview = CHECK_PREVIEWS[step.key];
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.group}>{text(STOREFRONT_GROUP_LABELS[meta.group]).toUpperCase()}</Text>
        <Text style={[styles.gain, tabular]}>{`+${step.gain} points`}</Text>
      </View>
      <Text style={styles.title}>{text(meta.title)}</Text>
      {check && <StepStatus check={check} meta={meta} plan={plan} />}
      {check?.cards && check.cards.length > 0 && <Text style={styles.label}>Your cards</Text>}
      {check?.cards && check.cards.length > 0 && <HeroCardList rows={check.cards} storeId={health.storeId} />}
      <Text style={styles.label}>What it is</Text>
      <Text style={styles.body}>{text(meta.what)}</Text>
      <Text style={styles.label}>Why it matters</Text>
      <Text style={styles.body}>{text(meta.why)}</Text>
      {preview && <Text style={styles.label}>Looks like this</Text>}
      {preview && <View style={styles.phone}><Image source={preview} style={styles.screen} accessibilityLabel={`${text(meta.title)} as shoppers see it`} /></View>}
      {evidence && <View style={styles.evidence}><Text style={styles.evidenceText}>{evidence}</Text></View>}
    </View>
  );
}

// Pinned under the step, so the choice is always in reach: set it up yourself, or let AI draft it
function StepActions({ step, storeId, plan }: { step: StorefrontSuggestion; storeId: string; plan: Entitlements | null }) {
  const router = useRouter();
  const ai = aiHref(step.key, storeId);
  // With no promotions left both ways would fail at the last step, so the way forward is the plan
  if (blockedByPlan(STOREFRONT_CHECKS[step.key], plan)) return <Button label="See plans" icon="rocket-outline" onPress={() => router.push("/manage/marketing-plan")} style={styles.action} />;
  return (
    <>
      <Button label={ai ? "Do it myself" : "Set it up"} icon={ai ? undefined : "arrow-forward"} variant={ai ? "secondary" : "primary"} onPress={() => router.push(setupHref(step.key, storeId))} style={styles.action} />
      {ai && <Button label="Do it for me" icon="flash" onPress={() => router.push(ai)} style={styles.aiAction} />}
    </>
  );
}

function SkipButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip this step" style={styles.skip}>
      <Text style={styles.skipText}>Skip</Text>
    </TouchableOpacity>
  );
}

/** One suggestion at a time, biggest gain first: what it is, why it matters, then the AI draft or the screen to set it up */
export default function StorefrontGuideScreen() {
  const { storeId, start } = useLocalSearchParams<{ storeId: string; start?: StorefrontCheckKey }>();
  const router = useRouter();
  const { data, loading, error, reload } = useStorefrontHealth(storeId, true);
  const { data: plan } = useEntitlements();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const total = useRef<number | null>(null);
  if (data && total.current === null) total.current = data.suggestions.length;
  const steps = remaining(data, skipped, start);
  const step = steps[0];
  const done = Math.max(0, (total.current ?? 0) - steps.length);

  return (
    <ManageStackScreen title="Storefront guide" loading={loading} error={error} onRetry={reload} scrollKey={step?.key}
      headerRight={step ? () => <SkipButton onPress={() => setSkipped((s) => new Set(s).add(step.key))} /> : undefined}
      actions={step ? <StepActions step={step} storeId={storeId} plan={plan} /> : undefined}>
      {data && (
        <View style={styles.top}>
          <Text style={[styles.score, tabular]}>{`Score ${data.score}`}<Text style={styles.outOf}>/100</Text></Text>
          <Text style={styles.count}>{step ? `Step ${done + 1} of ${total.current}` : "All done"}</Text>
        </View>
      )}
      {data && <View style={styles.track}><View style={[styles.fill, { width: `${total.current ? (done / total.current) * 100 : 100}%` }]} /></View>}
      {data && step && <Step key={step.key} health={data} step={step} plan={plan} />}
      {data && !step && (
        <EmptyState icon="sparkles-outline" title={skipped.size ? "That's the list for now" : "Your storefront is all set"}
          message={skipped.size ? "Skipped steps stay on the Storefront screen for later." : "Every feature that fits your store is on."}
          action={{ label: "Back to storefront", onPress: () => router.back() }} />
      )}
    </ManageStackScreen>
  );
}

// Width / height of the phone screenshots the previews are made from
const SCREEN_ASPECT = 1179 / 2556;

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  score: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  outOf: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  count: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  track: { height: 6, borderRadius: 3, backgroundColor: manage.hairline, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  card: { backgroundColor: manage.card, borderRadius: radius.xl, borderWidth: 1, borderColor: manage.line, padding: 18 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  group: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.primary },
  gain: { fontFamily: fonts.extrabold, fontSize: 13, color: "#15803d", backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" },
  title: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, marginTop: 10 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: manage.muted, marginTop: 16 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 4 },
  // A phone-shaped frame around a whole screen of the shopper app
  phone: { alignSelf: "center", marginTop: 10, padding: 5, borderRadius: 26, backgroundColor: colors.text },
  screen: { height: 400, aspectRatio: SCREEN_ASPECT, borderRadius: 21 },
  evidence: { backgroundColor: manage.attentionBg, borderRadius: radius.lg, padding: 10, marginTop: 16 },
  evidenceText: { fontFamily: fonts.semibold, fontSize: 13, color: manage.attentionText },
  action: { flex: 1 },
  aiAction: { flex: 1.6 },
  skip: { minHeight: 44, minWidth: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  // A set line height keeps the font's tall ascender from pushing the word below centre
  skipText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, textAlign: "center", color: colors.primary },
});
