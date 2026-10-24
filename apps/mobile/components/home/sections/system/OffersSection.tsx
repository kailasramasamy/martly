import { memo, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CouponOffer, HomeTheme, SystemSection } from "@martly/shared/types";
import { colors, fonts } from "../../../../constants/theme";
import { useCart } from "../../../../lib/cart-context";
import { offerCondition, useOfferTitle } from "../../../../lib/coupon-offer";
import { useToast } from "../../../../lib/toast-context";
import { useStrings } from "../../../../lib/i18n/use-strings";
import { useHomeSectionEnv } from "../context";

const TICKET_WIDTH = 248;
const TICKET_HEIGHT = 78;
const STUB_WIDTH = 70;
// White tickets stand off the cream band
const TICKET_FILL = "#ffffff";
const NOTCH = 12;
// Without a festival above it, the strip sits on a warm cream band that matches the amber stubs without shouting
const PLAIN: HomeTheme = { background: "#fdf3dc", title: "#92400e", dark: false };

/** "₹50" / "20%": the saving set big on the ticket's stub */
const stubValue = (o: CouponOffer) => (o.discountType === "FLAT" ? `₹${Math.round(o.discountValue)}` : `${Math.round(o.discountValue)}%`);

interface TicketProps {
  offer: CouponOffer;
  saved: boolean;
  band: HomeTheme;
  onSave: (code: string) => void;
}

/** A short coupon ticket: the saving on an amber stub (offers are always amber), a tear line, then what it is */
const Ticket = memo(function Ticket({ offer, saved, band, onSave }: TicketProps) {
  const t = useStrings("home");
  const title = useOfferTitle()(offer);
  return (
    <Pressable
      onPress={() => onSave(offer.code)}
      style={({ pressed }) => [styles.ticket, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={saved ? t.savedA11y(title) : t.tapToSaveA11y(title)}
    >
      <View style={styles.stub}>
        <Text style={styles.stubValue} numberOfLines={1} adjustsFontSizeToFit>{stubValue(offer)}</Text>
        <Text style={styles.stubOff}>{t.off}</Text>
      </View>
      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchTop, { backgroundColor: band.background }]} />
        <View style={styles.dash} />
        <View style={[styles.notch, styles.notchBottom, { backgroundColor: band.background }]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{title}</Text>
        <Text style={styles.condition} numberOfLines={1}>{offerCondition(offer)}</Text>
        <View style={styles.status}>
          <Ionicons name={saved ? "checkmark-circle" : "bookmark-outline"} size={13} color={saved ? colors.success : colors.textSecondary} />
          <Text style={[styles.statusText, saved && styles.savedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{saved ? t.savedForCheckout : t.tapToSave}</Text>
        </View>
      </View>
    </Pressable>
  );
});

/**
 * Coupons the shopper can use, as a strip of short tickets. Right under a festival hero it continues the hero's colour so
 * the top of Home reads as one block; elsewhere it sits on Martly's teal band. A tap saves the coupon for checkout.
 */
export const OffersSection = memo(function OffersSection({ section }: { section: SystemSection }) {
  const offers = section.data.offers as CouponOffer[];
  const { festiveTheme, afterHeroId } = useHomeSectionEnv();
  const { pendingCoupon, setPendingCoupon } = useCart();
  const toast = useToast();
  const t = useStrings("home");
  const band = afterHeroId === section.id && festiveTheme ? festiveTheme : PLAIN;
  const ink = band.title;

  const save = useCallback((code: string) => {
    setPendingCoupon(code);
    toast.show(t.couponApplied(code), "success");
  }, [setPendingCoupon, toast, t]);

  if (offers.length === 0) return null;
  return (
    <View style={[styles.band, { backgroundColor: band.background }, band !== PLAIN && styles.joined]}>
      <View style={styles.label}>
        <Ionicons name="sparkles" size={12} color={ink} />
        <Text style={[styles.labelText, { color: ink }]}>{t.offersForYou(offers.length)}</Text>
      </View>
      <FlatList
        horizontal
        data={offers}
        keyExtractor={(offer) => offer.code}
        extraData={pendingCoupon}
        renderItem={({ item }) => <Ticket offer={item} saved={pendingCoupon === item.code} band={band} onSave={save} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  band: { marginTop: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
  // Under the festive hero there's no gap: the strip is the hero block's last row
  joined: { marginTop: 0, paddingTop: 4 },
  label: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16 },
  labelText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 1.2 },
  rail: { paddingHorizontal: 16, gap: 10 },
  ticket: {
    width: TICKET_WIDTH, height: TICKET_HEIGHT, flexDirection: "row", borderRadius: 14, backgroundColor: TICKET_FILL, overflow: "hidden",
    borderWidth: 1, borderColor: "#f6dfa6",
  },
  pressed: { opacity: 0.85 },
  stub: { width: STUB_WIDTH, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: colors.accent },
  stubValue: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.accentText, letterSpacing: -0.5 },
  stubOff: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.accentText, letterSpacing: 1.5 },
  tear: { width: NOTCH, alignItems: "center" },
  notch: { position: "absolute", width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  dash: { flex: 1, marginVertical: NOTCH, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: "#e7d9b8" },
  body: { flex: 1, justifyContent: "center", paddingRight: 12, gap: 2 },
  title: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  condition: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  status: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statusText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  savedText: { color: colors.success },
});
