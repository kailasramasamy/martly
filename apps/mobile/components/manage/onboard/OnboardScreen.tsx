import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";
import { useManageScope } from "../../../lib/manage-scope-context";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { StickyActionBar } from "../ui/StickyActionBar";
import { manage } from "../ui/tokens";
import { useTaxonomy } from "../taxonomy/use-taxonomy";
import { BrowseStep } from "./BrowseStep";
import { PricingStep } from "./PricingStep";
import { ReviewStep } from "./ReviewStep";
import { pricingError, useOnboard } from "./use-onboard";
import type { OnboardStep } from "./types";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER"];
const STEPS = [
  { value: "browse" as const, label: "1 · Browse" },
  { value: "pricing" as const, label: "2 · Prices" },
  { value: "review" as const, label: "3 · Review" },
];

export function OnboardScreen({ storeId }: { storeId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { stores } = useManageScope();
  const { tree } = useTaxonomy();
  const [step, setStep] = useState<OnboardStep>("browse");
  const onboard = useOnboard(storeId, () => router.back());
  const store = stores.find((s) => s.id === storeId);
  const picked = Object.values(onboard.picked);

  if (!user || !ALLOWED_ROLES.includes(user.role) || (stores.length > 0 && !store)) {
    return <EmptyState icon="lock-closed-outline" title="Store not available" message="You can only onboard products for stores you manage." />;
  }

  const go = (target: OnboardStep) => {
    const problem = target === "review" ? pricingError(picked) : null;
    if (problem) return toast.show(problem, "error");
    setStep(target);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: store ? `Onboard · ${store.name}` : "Onboard products" }} />
      <View style={styles.steps}><SegmentedTabs options={STEPS} value={step} onChange={go} /></View>
      <View style={styles.body}>
        {step === "browse" && <BrowseStep tree={tree} picked={onboard.picked} onToggle={onboard.toggle} />}
        {step === "pricing" && (
          <PricingStep picked={picked} defaultStock={onboard.defaultStock} onDefaultStock={onboard.setDefaultStock} onApplyStock={onboard.applyStockToAll} onPatch={onboard.patch} />
        )}
        {step === "review" && <ReviewStep picked={picked} storeName={store?.name ?? "this store"} />}
      </View>
      <StickyActionBar>
        {step !== "browse" && <Button label="Back" variant="secondary" onPress={() => go(step === "review" ? "pricing" : "browse")} style={styles.back} />}
        {step === "review"
          ? <Button label={`Add ${picked.length} variants`} onPress={onboard.submit} loading={onboard.running} style={styles.primary} />
          : <Button label={`Next · ${picked.length} selected`} disabled={picked.length === 0} onPress={() => go(step === "browse" ? "pricing" : "review")} style={styles.primary} />}
      </StickyActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  steps: { padding: 12, borderBottomWidth: 1, borderBottomColor: manage.line },
  body: { flex: 1 },
  back: { flex: 1 },
  primary: { flex: 2 },
});
