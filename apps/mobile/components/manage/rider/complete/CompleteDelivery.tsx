import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, fonts } from "../../../../constants/theme";
import { ManageStackScreen } from "../../ManageStackScreen";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { formatINR, manage, tabular } from "../../ui/tokens";
import { orderRef } from "../format";
import { useRiderActions } from "../use-rider-actions";
import { useRiderDay } from "../use-rider-day";
import type { RiderStop } from "../types";
import { HandoverList } from "./HandoverStep";
import { PaymentBody } from "./PaymentStep";
import { ReturnsList } from "./ReturnsStep";
import { StepSection } from "./StepSection";
import { useCompleteDelivery } from "./use-complete-delivery";

type Flow = ReturnType<typeof useCompleteDelivery>;

function Who({ stop }: { stop: RiderStop }) {
  return (
    <View style={styles.who}>
      <Text style={styles.name}>{stop.user.name}</Text>
      <Text style={[styles.ref, tabular]}>Order {orderRef(stop.id)}</Text>
      <Text style={styles.address}>{stop.deliveryAddress ?? "No address"}</Text>
    </View>
  );
}

function Steps({ stop, flow }: { stop: RiderStop; flow: Flow }) {
  const units = stop.items.reduce((n, i) => n + i.quantity, 0);
  const hasReturns = stop.pickups.length > 0;
  return (
    <View>
      <StepSection number={1} title={`Hand over ${units} item${units === 1 ? "" : "s"}`} hint="Check each item with the customer. If they won't take one, tap “Customer not taking this?” and they won't pay for it.">
        <HandoverList items={stop.items} refused={flow.refused} onChange={flow.changeLine} />
      </StepSection>
      {hasReturns && (
        <StepSection number={2} title="Collect returned items" hint="Take these back from the customer. Tick a return only when you have every item in it." done={flow.checked.length === stop.pickups.length}>
          <ReturnsList pickups={stop.pickups} checked={flow.checked} onToggle={flow.toggle} />
        </StepSection>
      )}
      <StepSection number={hasReturns ? 3 : 2} title={flow.cod ? "Collect payment" : "Payment"} last>
        <PaymentBody cod={flow.cod} fullDue={stop.amountDue} refusedValue={flow.value} via={flow.via} onVia={flow.setVia} />
      </StepSection>
    </View>
  );
}

function ConfirmBar({ flow, running, onConfirm }: { flow: Flow; running: boolean; onConfirm: () => void }) {
  return (
    <View style={styles.bar}>
      <View style={styles.barText}>
        <Text style={styles.barLabel}>{flow.cod ? `Collect · ${flow.via === "UPI" ? "UPI" : "Cash"}` : "Paid online"}</Text>
        <Text style={[styles.barAmount, tabular]}>{flow.cod ? formatINR(flow.due) : "Nothing to collect"}</Text>
        {flow.blocker ? <Text style={styles.blocker}>{flow.blocker}</Text> : null}
      </View>
      <Button label="Confirm delivery" icon="checkmark" onPress={onConfirm} loading={running} disabled={!!flow.blocker} style={styles.confirm} />
    </View>
  );
}

/** Full-screen delivery checklist: hand over (with items not taken), collect returns, collect payment */
export function CompleteDelivery({ orderId, date }: { orderId: string; date: string }) {
  const rider = useRiderDay(date);
  const actions = useRiderActions(rider.reload);
  const stop = rider.day?.trips.flatMap((t) => t.orders).find((s) => s.id === orderId) ?? null;
  const flow = useCompleteDelivery(stop);
  const confirm = async () => {
    if (!stop) return;
    const done = await actions.deliver(stop.id, flow.cod ? flow.via : undefined, flow.lines, flow.checked);
    if (done) router.back();
  };
  const open = stop && stop.status === "OUT_FOR_DELIVERY";

  return (
    <ManageStackScreen
      title="Complete delivery"
      loading={rider.loading}
      error={rider.error}
      onRetry={rider.refresh}
      actions={open ? <ConfirmBar flow={flow} running={actions.running} onConfirm={confirm} /> : undefined}
    >
      {open
        ? <><Who stop={stop} /><Steps stop={stop} flow={flow} /></>
        : <EmptyState icon="checkmark-done-outline" title="Nothing to deliver here" message="This stop is already done or no longer on your trip." />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  who: { paddingBottom: 8 },
  name: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  ref: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  address: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, marginTop: 6 },
  bar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  barText: { flex: 1 },
  barLabel: { fontFamily: fonts.semibold, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textSecondary },
  barAmount: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  blocker: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.error, marginTop: 2 },
  confirm: { minWidth: 170 },
});
