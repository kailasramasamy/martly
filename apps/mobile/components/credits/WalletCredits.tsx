import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useCredits } from "../../lib/credits-context";
import { expiryLabel, rupees, useCreditCopy } from "../../lib/credit-copy";
import { Coin } from "./Coin";

/** The Martly Cash the customer holds, each grant with its terms and expiry */
export function WalletCredits() {
  const t = useStrings("credits").wallet;
  const copy = useCreditCopy();
  const { grants } = useCredits();
  if (grants.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.title}</Text>
      {grants.map((grant) => (
        <View key={grant.id} style={styles.card}>
          <Coin size={40} />
          <View style={styles.info}>
            <Text style={styles.name}>{copy.name(grant)}</Text>
            <Text style={styles.detail}>{t.minOrder(rupees(grant.minOrderAmount))}</Text>
            <Text style={styles.detail}>
              {grant.storeName ? `${t.onlyAt(grant.storeName)} · ` : ""}{t.expires(expiryLabel(grant.expiresAt))}
            </Text>
          </View>
          <Text style={styles.amount}>{"₹"}{rupees(grant.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 20, gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: 2 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
  },
  info: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  amount: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.accentText },
});
