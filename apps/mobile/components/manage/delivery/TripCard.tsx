import { useState } from "react";
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { SectionCard } from "../ui/SectionCard";
import { manage, tabular } from "../ui/tokens";
import { TRIP_STATUS } from "./trip-status";
import { TripStop } from "./TripStop";
import { useDispatchAccess } from "./use-dispatch-access";
import type { MenuOrder, Trip } from "./types";

interface TripCardProps {
  trip: Trip;
  onChanged: () => void;
  onMenu: (order: MenuOrder) => void;
}

export function TripCard({ trip, onChanged, onMenu }: TripCardProps) {
  const { run, running } = useAction();
  const { canDispatch, userId } = useDispatchAccess();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mine = trip.rider.id === userId;
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
        {!mine && (
          <View style={styles.avatar}>
            <Ionicons name="bicycle" size={18} color={colors.primary} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={styles.rider}>{mine ? "Your trip" : trip.rider.name}</Text>
          <Text style={[styles.sub, tabular]}>{mine ? "" : `${trip.rider.phone ?? "No phone"} · `}{delivered}/{trip.orders.length} delivered</Text>
        </View>
        {status && <StatusPill {...status} dot />}
        {!mine && trip.rider.phone ? (
          <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${trip.rider.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${trip.rider.name}`}>
            <Ionicons name="call" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {trip.orders.map((o) => (
        <TripStop key={o.id} order={o} canDeliver={canDispatch || mine} forRider={mine} onChanged={onChanged} onMenu={() => onMenu(o)} />
      ))}
      {trip.status === "CREATED" && (canDispatch || mine) && (
        <View style={styles.actions}>
          <Button label="Start trip" icon="play" loading={running} style={styles.flex}
            onPress={() => act(() => api.patch(`/api/v1/delivery-trips/${trip.id}/start`), "Trip started")} />
          {canDispatch && <Button label="Cancel" variant="danger" onPress={() => setConfirmCancel(true)} />}
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
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  call: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
  rider: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, padding: 12 },
  flex: { flex: 1 },
});
