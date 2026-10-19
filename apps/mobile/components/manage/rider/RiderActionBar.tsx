import { View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { TabBottomDock } from "../../TabIcon";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { isPacked } from "./StopLine";
import { orderRef } from "./format";
import type { RiderStop, RiderTrip } from "./types";

interface RiderActionBarProps {
  /** The trip on the road, or the next one waiting to start */
  trip: RiderTrip | null;
  next: RiderStop | null;
  starting: boolean;
  onStart: (tripId: string) => void;
  onArrive: (stop: RiderStop) => void;
  onLayout: (e: LayoutChangeEvent) => void;
}

/** The one thing to do now, pinned above the tabs in thumb reach: start the trip or complete the stop you're at */
export function RiderActionBar({ trip, next, starting, onStart, onArrive, onLayout }: RiderActionBarProps) {
  if (!trip) return null;
  if (trip.status === "IN_PROGRESS" && !next) return null;
  const unpacked = trip.orders.filter((s) => !isPacked(s)).length;
  return (
    <TabBottomDock onLayout={onLayout}>
      <View style={styles.bar}>
        {next ? (
          <>
            <Text style={styles.caption} numberOfLines={1}>{next.user.name} · {orderRef(next.id)}</Text>
            <Button label="Arrived — complete delivery" icon="checkmark-circle" onPress={() => onArrive(next)} style={styles.button} />
          </>
        ) : (
          <>
            <Text style={[styles.caption, unpacked > 0 && styles.waiting]} numberOfLines={1}>
              {unpacked > 0 ? `Waiting for ${unpacked} order${unpacked === 1 ? "" : "s"} to be packed` : `${trip.orders.length} stop${trip.orders.length === 1 ? "" : "s"} packed and ready`}
            </Text>
            <Button label="Start trip" icon="play" loading={starting} disabled={unpacked > 0} onPress={() => onStart(trip.id)} style={styles.button} />
          </>
        )}
      </View>
    </TabBottomDock>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line },
  caption: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  waiting: { color: "#1d4ed8" },
  button: { height: 58 },
});
