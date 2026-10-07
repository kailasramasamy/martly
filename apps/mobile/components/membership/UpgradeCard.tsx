import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { MembershipUpgradeOption } from "../../lib/types";

interface Props {
  option: MembershipUpgradeOption;
  busy: boolean;
  disabled: boolean;
  onUpgrade: (option: MembershipUpgradeOption) => void;
}

export function UpgradeCard({ option, busy, disabled, onUpgrade }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{option.plan.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.original}>{"\u20B9"}{option.plan.price}</Text>
        <Text style={styles.charge}>{option.isFree ? "FREE" : `\u20B9${option.upgradeCharge}`}</Text>
      </View>
      <View style={styles.credit}>
        <Ionicons name="gift-outline" size={15} color="#b45309" />
        <Text style={styles.creditText}>{"\u20B9"}{option.credit} credit from your current plan</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => onUpgrade(option)} disabled={disabled} activeOpacity={0.85}>
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {option.isFree ? "Upgrade for free" : `Upgrade · \u20B9${option.upgradeCharge}`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  original: { fontFamily: fonts.medium, fontSize: 15, color: "#94a3b8", textDecorationLine: "line-through" },
  charge: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  credit: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10,
    backgroundColor: "#fef3c7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  creditText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  button: {
    height: 46, borderRadius: 12, backgroundColor: colors.primary, marginTop: 14,
    alignItems: "center", justifyContent: "center",
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
});
