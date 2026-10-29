import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useCredits } from "../../lib/credits-context";
import { useCreditCopy } from "../../lib/credit-copy";
import { Coin } from "./Coin";
import { bestOffer } from "./HomeCredits";

/** One line on the login screen telling a new customer what signing up gives them */
export function LoginCreditCallout() {
  const t = useStrings("credits").banner;
  const copy = useCreditCopy();
  const { offers } = useCredits();
  const offer = bestOffer(offers);
  if (!offer) return null;
  return (
    <View style={styles.row}>
      <Coin size={22} />
      <Text style={styles.text} numberOfLines={2}>{t.loginCallout(copy.headline(offer))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginTop: 14, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: "#fef3c7",
  },
  text: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
});
