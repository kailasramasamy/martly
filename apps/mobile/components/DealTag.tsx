import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MultiBuyOffer } from "@martly/shared/offers";
import { colors, fonts } from "../constants/theme";
import type { CardDeal } from "../lib/deal";
import { useStrings } from "../lib/i18n/use-strings";

interface Props {
  deal: CardDeal;
  /** The deal's badge text, from useDealLabel */
  label: string | null;
  offer: MultiBuyOffer | null | undefined;
}

/**
 * The one tag under a card's price: a buy X get Y offer beats a saving, as it is the bigger draw; a store promotion
 * is amber, everyday below-MRP pricing a brand-teal strip, so it stands out without passing for a promotion
 */
export function DealTag({ deal, label, offer }: Props) {
  if (offer) return <OfferTag offer={offer} />;
  if (!label) return null;
  const mrp = deal.kind === "MRP";
  return (
    <View style={[styles.tag, mrp && styles.mrp]}>
      <Text style={[styles.text, mrp && styles.light]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** "Buy 1 Get 1" with a gift, wherever a pack's price shows */
export function OfferTag({ offer }: { offer: MultiBuyOffer }) {
  const tc = useStrings("common");
  return (
    <View style={[styles.tag, styles.offer]}>
      <Ionicons name="gift" size={10} color={colors.accent} />
      <Text style={[styles.text, styles.light]} numberOfLines={1}>{tc.buyGet(offer.buy, offer.get)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start",
    backgroundColor: colors.salePill, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, marginTop: 5, marginBottom: 3,
  },
  mrp: { backgroundColor: colors.primary },
  offer: { backgroundColor: colors.primaryDark },
  text: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.2, color: colors.salePillText },
  light: { color: "#ffffff" },
});
