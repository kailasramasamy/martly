import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { PickupThumbs } from "../PickupItems";
import { cashHandBack, orderRef } from "../format";
import { formatINR } from "../../ui/tokens";
import type { OrderPickup } from "../../orders/types";

/** Step 2: each return waiting with this customer; ticking one says the rider has all its items */
export function ReturnsList({ pickups, checked, onToggle }: { pickups: OrderPickup[]; checked: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      {pickups.map((p) => {
        const on = checked.includes(p.id);
        const cash = cashHandBack(p);
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.card, on && styles.cardOn]}
            onPress={() => onToggle(p.id)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <View style={styles.head}>
              <Ionicons name={on ? "checkbox" : "square-outline"} size={28} color={on ? colors.primary : manage.attentionText} />
              <View style={styles.headText}>
                <Text style={styles.title}>Return on order {orderRef(p.orderId)}</Text>
                <Text style={styles.reason}>{p.reason}</Text>
              </View>
            </View>
            <PickupThumbs lines={p.items} size={52} />
            <Text style={styles.items}>{p.items.map((i) => `${i.quantity} × ${i.orderItem.product.name} ${i.orderItem.variant.name}`).join("\n")}</Text>
            {cash > 0 && (
              <View style={styles.cash}>
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.cashText}>Hand back {formatINR(cash)} cash</Text>
              </View>
            )}
            <Text style={[styles.state, on && styles.stateOn]}>{on ? (cash > 0 ? "Collected · hand the cash back" : "Collected · customer will be refunded") : "Tap when you have all of these"}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: manage.attentionBg, borderWidth: 2, borderColor: "transparent" },
  cardOn: { backgroundColor: manage.tint, borderColor: colors.primary },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headText: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  reason: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  items: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.text },
  cash: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary },
  cashText: { fontFamily: fonts.extrabold, fontSize: 17, color: "#fff" },
  state: { fontFamily: fonts.bold, fontSize: 13, color: manage.attentionText },
  stateOn: { color: colors.primary },
});
