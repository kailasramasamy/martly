import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CreditOffer } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useCredits } from "../../lib/credits-context";
import { rupees, useCreditCopy } from "../../lib/credit-copy";
import { Coin } from "./Coin";
import { CreditStrip } from "./CreditStrip";

/** The richest offer a guest could sign up for */
export const bestOffer = (offers: CreditOffer[]) => offers.reduce<CreditOffer | null>((best, o) => (!best || o.amount > best.amount ? o : best), null);

function GuestBanner({ offer }: { offer: CreditOffer }) {
  const t = useStrings("credits").banner;
  const copy = useCreditCopy();
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.banner} activeOpacity={0.9} onPress={() => router.push("/(auth)/login")} accessibilityRole="button">
      <Coin size={36} />
      <View style={styles.bannerText}>
        <Text style={styles.headline} numberOfLines={2}>{copy.headline(offer)}</Text>
        <Text style={styles.cta}>{t.signUp}</Text>
      </View>
      <Ionicons name="arrow-forward-circle" size={26} color={colors.accent} />
    </TouchableOpacity>
  );
}

function SavedForArrival({ amount }: { amount: number }) {
  const t = useStrings("credits").saved;
  return (
    <View style={styles.saved}>
      <Ionicons name="location-outline" size={22} color={colors.primary} />
      <View style={styles.bannerText}>
        <Text style={styles.savedTitle}>{t.title}</Text>
        <Text style={styles.savedBody}>{t.body(rupees(amount))}</Text>
      </View>
    </View>
  );
}

/** Under Home's lead section: the sign-up offer for guests, the saved gift outside delivery areas, or the reminder to spend credit */
export function HomeCredits() {
  const { isCustomer, grants, storeGrants, pending, offers, outOfArea } = useCredits();
  const offer = bestOffer(offers);
  const saved = isCustomer && grants.length === 0 && outOfArea ? bestOffer(pending) : null;
  const strip = isCustomer && storeGrants.length > 0;
  const banner = !isCustomer && !outOfArea ? offer : null;
  if (!banner && !saved && !strip) return null;

  return (
    <View style={styles.wrap}>
      {banner && <GuestBanner offer={banner} />}
      {saved && <SavedForArrival amount={saved.amount} />}
      {strip && <CreditStrip grants={storeGrants} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10, paddingLeft: 12, paddingRight: 10,
    borderRadius: 14, backgroundColor: colors.primaryDark,
  },
  bannerText: { flex: 1 },
  headline: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
  cta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent, marginTop: 1 },
  saved: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#99f6e4",
  },
  savedTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  savedBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
