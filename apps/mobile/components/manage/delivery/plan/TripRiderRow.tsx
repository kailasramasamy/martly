import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { firstName, lastSeenText } from "./format";
import type { PlanRider, PlanTrip } from "./types";

interface TripRiderRowProps {
  trip: PlanTrip;
  suggested: PlanRider | null;
  /** Dispatchers can change the rider until the trip starts */
  onChange?: () => void;
  /** On-the-road trips: open the live map */
  onMap?: () => void;
}

/** Who rides this trip: the assigned rider, or the suggestion waiting for a confirm */
export function TripRiderRow({ trip, suggested, onChange, onMap }: TripRiderRowProps) {
  const rider = trip.rider;
  const onRoad = trip.status === "IN_PROGRESS";
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, !rider && styles.avatarGhost]}>
        <Ionicons name="bicycle" size={16} color={rider ? colors.primary : manage.muted} />
      </View>
      <View style={styles.who}>
        <Text style={[styles.name, !rider && styles.suggest]} numberOfLines={1}>
          {rider ? rider.name : suggested ? `Suggested: ${firstName(suggested.name)}` : "No rider yet"}
        </Text>
        {onRoad && <Text style={[styles.seen, !trip.live && styles.seenOff]} numberOfLines={1}>{lastSeenText(trip.live)}</Text>}
      </View>
      {onChange && (
        <TouchableOpacity style={styles.change} onPress={onChange} accessibilityRole="button" accessibilityLabel="Change rider">
          <Text style={styles.changeLabel}>{rider || suggested ? "Change" : "Pick rider"}</Text>
        </TouchableOpacity>
      )}
      {onMap && (
        <TouchableOpacity style={styles.call} onPress={onMap} accessibilityRole="button" accessibilityLabel="Show rider on map">
          <Ionicons name="map" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
      {onRoad && rider?.phone ? (
        <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${rider.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${rider.name}`}>
          <Ionicons name="call" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 52 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  avatarGhost: { backgroundColor: manage.canvas },
  who: { flex: 1, minWidth: 0 },
  seen: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary, marginTop: 1 },
  seenOff: { color: manage.muted },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  suggest: { fontFamily: fonts.semibold, color: manage.attentionText },
  change: { minHeight: 44, minWidth: 64, alignItems: "flex-end", justifyContent: "center" },
  changeLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  call: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
});
