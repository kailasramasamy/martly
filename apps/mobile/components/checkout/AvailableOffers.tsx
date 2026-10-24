import { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CouponOffer } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { api } from "../../lib/api";
import { offerCondition, useOfferTitle } from "../../lib/coupon-offer";
import { useStrings } from "../../lib/i18n/use-strings";

interface Props {
  storeId: string | null;
  orderAmount: number;
  disabled: boolean;
  onApply: (code: string) => void;
}

/** Offers the shopper can use on this cart: ready ones first with Apply, the rest say how much more to add */
function useAvailableOffers(storeId: string | null, orderAmount: number) {
  const [offers, setOffers] = useState<CouponOffer[]>([]);
  useEffect(() => {
    if (!storeId) return;
    let live = true;
    api.get<CouponOffer[]>(`/api/v1/coupons/available?storeId=${storeId}&orderAmount=${orderAmount}`)
      // Offers are a convenience: without them the promo code box still works
      .then((res) => { if (live) setOffers(res.data); })
      .catch(() => { if (live) setOffers([]); });
    return () => { live = false; };
  }, [storeId, orderAmount]);
  return offers;
}

function OfferRow({ offer, disabled, onApply }: { offer: CouponOffer; disabled: boolean; onApply: (code: string) => void }) {
  const t = useStrings("checkout").promo;
  const title = useOfferTitle()(offer);
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.condition} numberOfLines={1}>{offer.code} · {offerCondition(offer)}</Text>
      </View>
      {offer.eligible ? (
        <Pressable
          onPress={() => onApply(offer.code)}
          disabled={disabled}
          style={({ pressed }) => [styles.apply, (pressed || disabled) && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel={t.applyCode(offer.code)}
        >
          <Text style={styles.applyText}>{t.apply}</Text>
        </Pressable>
      ) : (
        <Text style={styles.short}>{t.addMore(Math.ceil(offer.shortBy ?? 0))}</Text>
      )}
    </View>
  );
}

export const AvailableOffers = memo(function AvailableOffers({ storeId, orderAmount, disabled, onApply }: Props) {
  const t = useStrings("checkout").promo;
  const offers = useAvailableOffers(storeId, orderAmount);
  if (offers.length === 0) return null;
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{t.availableOffers}</Text>
      {offers.map((offer) => <OfferRow key={offer.code} offer={offer} disabled={disabled} onApply={onApply} />)}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: { backgroundColor: "#f0fdfa", borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  heading: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryDark, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  text: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  condition: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  apply: { minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  applyText: { fontFamily: fonts.bold, fontSize: 14, color: "#fff" },
  short: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  dim: { opacity: 0.6 },
});
