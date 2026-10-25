import {  } from "react-native";
import { Loader } from "../../../Loader";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors } from "../../../../constants/theme";
import { useAuth } from "../../../../lib/auth-context";
import { EmptyState } from "../../ui/EmptyState";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { PlanOverlays } from "./PlanSheets";
import { WaveBoard } from "./WaveBoard";
import { orderCount, waveKey } from "./format";
import { usePlanActions } from "./use-plan-actions";
import { useDispatchAccess } from "../use-dispatch-access";
import type { usePlanDesk } from "./use-plan-desk";
import type { DeliveryPlan, PlanWave } from "./types";

type Desk = ReturnType<typeof usePlanDesk>;

function WaveSection({ desk, plan, wave }: { desk: Desk; plan: DeliveryPlan; wave: PlanWave }) {
  const { user } = useAuth();
  const { canDispatch } = useDispatchAccess();
  const { storeId, sheets } = desk;
  const actions = usePlanActions({ storeId: storeId as string, date: plan.date, wave, setPlan: desk.data.setPlan, reload: desk.data.reloadQuietly });
  const handlers = {
    actions, canDispatch, riders: plan.riders,
    onPickRider: sheets.pickRider, onMove: sheets.pickMove, onFail: sheets.pickFail, onOpenStop: sheets.openStop,
  };
  return (
    <>
      <WaveBoard wave={wave} canDispatch={canDispatch} handlers={handlers} sheets={sheets} />
      <PlanOverlays
        plan={plan} wave={wave} sheets={sheets} actions={actions}
        canEditRoster={can(user, "delivery-fleet")}
        onChanged={desk.data.reloadQuietly}
        onManageRiders={desk.openRiders}
      />
    </>
  );
}

/** Store prompt, spinner, error, no-slots notice, or the wave picker with the selected wave */
export function PlanContent({ desk }: { desk: Desk }) {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, data, wave } = desk;
  if (!storeId) {
    return desk.scopeLoading
      ? <Loader style={{ marginTop: 40 }} />
      : <EmptyState icon="storefront-outline" title="Pick a store" message="Delivery is planned per store. Choose one from the switcher above." />;
  }
  if (data.loading) return <Loader style={{ marginTop: 40 }} />;
  if (data.error || !data.plan) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={data.error ?? undefined} action={{ label: "Try again", onPress: data.refresh }} />;
  const plan = data.plan;
  if (!wave || plan.waves.length === 0) {
    return (
      <EmptyState
        icon="time-outline"
        title="No delivery slots"
        message="There are no delivery windows for this day. Set up time slots to start planning."
        action={can(user, "delivery-slots") ? { label: "Delivery setup", onPress: () => router.push("/manage/delivery-slots") } : undefined}
      />
    );
  }
  return (
    <>
      <SegmentedTabs
        value={desk.waveKey ?? ""}
        onChange={desk.pickWave}
        countTone="neutral"
        options={plan.waves.map((w) => ({ value: waveKey(w), label: w.label, count: orderCount(w) }))}
      />
      <WaveSection key={waveKey(wave)} desk={desk} plan={plan} wave={wave} />
    </>
  );
}
