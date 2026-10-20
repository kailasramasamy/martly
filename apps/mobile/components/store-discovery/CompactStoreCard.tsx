import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Store } from "../../lib/types";
import { useStoreBranding, type StoreBranding } from "./branding";
import { EtaChip } from "./StoreCards";
import { StoreLogo } from "./StoreLogo";
import { CoverCarousel, OffersTag } from "./CoverCarousel";
import { DeliveryOptions } from "./DeliveryOptions";
import { distanceText, getStoreArea } from "./store-info";
import { DirectionsButton } from "./DirectionsButton";

const COVER = 140;
const LOGO = 48;

interface CompactStoreCardProps {
  store: Store;
  selected: boolean;
  onPress: (store: Store) => void;
}

function whereText(store: Store): string {
  const parts = [getStoreArea(store), distanceText(store)];
  if (store.deliversToYou === false) parts.push(strings("home").outsideArea);
  return parts.filter(Boolean).join("  ·  ");
}

function BannerChips({ store, brand, selected }: { store: Store; brand: StoreBranding; selected: boolean }) {
  const t = useStrings("home");
  return (
    <View style={styles.coverRow}>
      {store.expressEtaMinutes ? <EtaChip minutes={store.expressEtaMinutes} onImage /> : <View />}
      {selected && (
        <View style={[styles.current, { backgroundColor: brand.color }]}>
          <Ionicons name="checkmark" size={12} color={brand.onColor} />
          <Text style={[styles.currentText, { color: brand.onColor }]}>{t.current}</Text>
        </View>
      )}
    </View>
  );
}

/** One store in the switcher: its photo and promo posters, logo, tagline, specialities and best offer */
export function CompactStoreCard({ store, selected, onPress }: CompactStoreCardProps) {
  const brand = useStoreBranding(store);
  const textColor = brand.onColor === "#fff" ? brand.color : colors.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, selected && { borderColor: brand.color, borderWidth: 2 }, pressed && styles.pressed]}
      onPress={() => onPress(store)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={brand.name}
    >
      <CoverCarousel store={store} brand={brand} height={COVER} overlay={<BannerChips store={store} brand={brand} selected={selected} />} />
      <View style={[styles.stripe, { backgroundColor: brand.color }]} />
      <View style={styles.logo}><StoreLogo store={store} brand={brand} size={LOGO} /></View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
          <OffersTag store={store} />
        </View>
        {brand.tagline ? <Text style={styles.tagline} numberOfLines={2}>{brand.tagline}</Text> : null}
        {(store.highlights?.length ?? 0) > 0 && (
          <View style={styles.chips}>
            {store.highlights?.map((h) => (
              <View key={h} style={[styles.chip, { backgroundColor: brand.tint }]}><Text style={[styles.chipText, { color: textColor }]}>{h}</Text></View>
            ))}
          </View>
        )}
        {brand.offer && (
          <View style={styles.offer}>
            <Ionicons name={brand.offer.icon} size={13} color={colors.accentText} />
            <Text style={styles.offerText} numberOfLines={1}>{brand.offer.text}</Text>
          </View>
        )}
        <DeliveryOptions store={store} inset={14} />
        <View style={styles.whereRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.where} numberOfLines={2}>{whereText(store)}</Text>
          <DirectionsButton store={store} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: colors.border,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  coverRow: { flexDirection: "row", justifyContent: "space-between", padding: 10 },
  current: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  currentText: { fontFamily: fonts.bold, fontSize: 12 },
  stripe: { height: 3 },
  logo: {
    position: "absolute", top: COVER - LOGO / 2, left: 14, padding: 3, backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#0f172a", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  body: { paddingHorizontal: 14, paddingTop: LOGO / 2 + 12, paddingBottom: 14, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.2 },
  tagline: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: -2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: fonts.bold, fontSize: 11.5 },
  offer: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#fef3c7", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  offerText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.accentText },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  where: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
});
