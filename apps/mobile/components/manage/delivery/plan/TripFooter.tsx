import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts } from "../../../../constants/theme";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { manage } from "../../ui/tokens";
import type { PlanActions } from "./use-plan-actions";
import type { PlanRider, PlanTrip } from "./types";

interface TripFooterProps {
  trip: PlanTrip;
  suggested: PlanRider | null;
  actions: PlanActions;
}

/** Dispatcher actions for an unstarted trip: confirm the suggestion, start, or cancel */
export function TripFooter({ trip, suggested, actions }: TripFooterProps) {
  const [confirming, setConfirming] = useState(false);
  const planned = trip.status === "PLANNED";
  const allPacked = trip.packed >= trip.stops.length;
  const reason = !planned && !allPacked ? `${trip.packed} of ${trip.stops.length} packed. Wait for the rest, or move the others off this trip.` : null;
  return (
    <View style={styles.wrap}>
      {reason && <Text style={styles.reason}>{reason}</Text>}
      <View style={styles.row}>
        {planned && suggested && trip.suggestedRiderId && (
          <Button compact label={`Assign ${suggested.name.split(" ")[0]}`} icon="checkmark" loading={actions.running} style={styles.flex}
            onPress={() => actions.assign([{ tripId: trip.id, riderId: trip.suggestedRiderId as string }], "Rider assigned")} />
        )}
        {!planned && (
          <Button compact label="Start trip" icon="play" disabled={!allPacked} loading={actions.running} style={styles.flex} onPress={() => actions.start(trip.id)} />
        )}
        <Button compact variant="danger" label="Cancel trip" onPress={() => setConfirming(true)} />
      </View>
      <ConfirmDialog
        visible={confirming}
        title="Cancel this trip?"
        message="Its orders go back to the unplanned list."
        confirmLabel="Cancel trip"
        cancelLabel="Keep trip"
        running={actions.running}
        onConfirm={async () => { await actions.cancel(trip.id); setConfirming(false); }}
        onClose={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: manage.hairline },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  reason: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.attentionText },
});
