import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { pickupText } from "../rider/format";
import type { OrderPickup } from "./types";

/** Reminder for staff that the rider should bring back a returned item with this order */
export function PickupCallout({ pickups }: { pickups: OrderPickup[] }) {
  if (!pickups.length) return null;
  return (
    <View style={styles.note}>
      <Ionicons name="return-down-back-outline" size={18} color={manage.attentionText} />
      <Text style={styles.text}>Return to collect: {pickupText(pickups)} — remind the rider</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: manage.attentionBg, borderLeftWidth: 4, borderLeftColor: colors.accent },
  text: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: manage.attentionText },
});
