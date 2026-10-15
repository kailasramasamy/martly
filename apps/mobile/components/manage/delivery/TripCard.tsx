import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { SectionCard } from "../ui/SectionCard";
import { ORDER_STATUS, formatINR, manage, tabular } from "../ui/tokens";
import { TRIP_STATUS } from "./trip-status";
import type { Trip } from "./types";

interface TripCardProps {
  trip: Trip;
  onChanged: () => void;
}

export function TripCard({ trip, onChanged }: TripCardProps) {
  const { run, running } = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const delivered = trip.orders.filter((o) => o.status === "DELIVERED").length;
  const status = TRIP_STATUS[trip.status];

  const act = async (fn: () => Promise<unknown>, message: string) => {
    const res = await run(fn, message);
    setConfirmCancel(false);
    if (res !== undefined) onChanged();
  };

  return (
    <SectionCard flush>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.rider}>{trip.rider.name}</Text>
          <Text style={[styles.sub, tabular]}>{trip.rider.phone ?? "No phone"} · {delivered}/{trip.orders.length} delivered</Text>
        </View>
        {status && <StatusPill {...status} dot />}
      </View>
      {trip.orders.map((o) => (
        <ListRow
          key={o.id}
          title={`#${o.id.slice(0, 8)} · ${o.user.name}`}
          subtitle={o.deliveryAddress ?? undefined}
          value={formatINR(o.totalAmount)}
          railColor={ORDER_STATUS[o.status]?.color}
          trailing={
            o.status === "OUT_FOR_DELIVERY" ? (
              <Button compact label="Delivered" icon="checkmark" loading={running}
                onPress={() => act(() => api.patch(`/api/v1/orders/${o.id}/status`, { status: "DELIVERED" }), "Order delivered")} />
            ) : <StatusPill {...ORDER_STATUS[o.status]} />
          }
        />
      ))}
      {trip.status === "CREATED" && (
        <View style={styles.actions}>
          <Button label="Start trip" icon="play" loading={running} style={styles.flex}
            onPress={() => act(() => api.patch(`/api/v1/delivery-trips/${trip.id}/start`), "Trip started")} />
          <Button label="Cancel" variant="danger" onPress={() => setConfirmCancel(true)} />
        </View>
      )}
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel this trip?"
        message="Its orders return to the unassigned pool."
        confirmLabel="Cancel trip"
        cancelLabel="Keep trip"
        running={running}
        onConfirm={() => act(() => api.patch(`/api/v1/delivery-trips/${trip.id}/cancel`), "Trip cancelled")}
        onClose={() => setConfirmCancel(false)}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  headText: { flex: 1 },
  rider: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, padding: 12 },
  flex: { flex: 1 },
});
