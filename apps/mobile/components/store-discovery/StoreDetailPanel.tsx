import { useState } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { PosterViewer } from "./PosterViewer";
import { BANNER_ASPECT } from "../HeroBannerSlide";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import { useStoreBranding, type StoreBranding } from "./branding";
import { EtaChip, OpenStatus } from "./StoreCards";
import { StoreLogo } from "./StoreLogo";
import { CoverCarousel, OffersTag } from "./CoverCarousel";
import { DeliveryOptions } from "./DeliveryOptions";
import { distanceText, getStoreArea } from "./store-info";
import { DirectionsButton } from "./DirectionsButton";

// Same shape as the home screen's banners; the panel spans the screen less its 16px gutters
const COVER = Math.round((Dimensions.get("window").width - 32) / BANNER_ASPECT);
const LOGO = 60;

function CoverChips({ store }: { store: Store }) {
  const rated = (store.ratingCount ?? 0) > 0 && store.ratingAvg != null;
  return (
    <View style={styles.coverChips}>
      {store.expressEtaMinutes ? <EtaChip minutes={store.expressEtaMinutes} onImage /> : <View />}
      {rated && (
        <View style={styles.rating}>
          <Ionicons name="star" size={12} color={colors.accent} />
          <Text style={styles.ratingText}>{store.ratingAvg?.toFixed(1)}</Text>
        </View>
      )}
    </View>
  );
}

function OfferRibbon({ offer }: { offer: NonNullable<StoreBranding["offer"]> }) {
  return (
    <View style={styles.offer}>
      <Ionicons name={offer.icon} size={14} color={colors.accentText} />
      <Text style={styles.offerText} numberOfLines={2}>{offer.text}</Text>
    </View>
  );
}

function Highlights({ items, brand }: { items: string[]; brand: StoreBranding }) {
  if (items.length === 0) return null;
  const textColor = brand.onColor === "#fff" ? brand.color : colors.text;
  return (
    <View style={styles.chips}>
      {items.map((h) => (
        <View key={h} style={[styles.chip, { backgroundColor: brand.tint }]}>
          <Text style={[styles.chipText, { color: textColor }]}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

/** Everything about one store: photo and promo posters, logo, tagline, specialities, best offer, delivery and where it is */
export type StoreBanner = NonNullable<Store["banners"]>[number];

export function StoreDetailPanel({ store, onBannerPress }: { store: Store; onBannerPress: (store: Store, banner: StoreBanner) => void }) {
  const [poster, setPoster] = useState<string | null>(null);
  const brand = useStoreBranding(store);
  const where = [getStoreArea(store), distanceText(store)].filter(Boolean).join("  ·  ");
  return (
    <View style={styles.card}>
      <CoverCarousel store={store} brand={brand} height={COVER} overlay={<CoverChips store={store} />} onBannerPress={(b) => onBannerPress(store, b)} onPosterPress={setPoster} />
      <PosterViewer uri={poster} onClose={() => setPoster(null)} />
      <View style={[styles.stripe, { backgroundColor: brand.color }]} />
      <View style={styles.logo}><StoreLogo store={store} brand={brand} size={LOGO} /></View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
          <OffersTag store={store} />
        </View>
        {brand.tagline ? <Text style={styles.tagline} numberOfLines={2}>{brand.tagline}</Text> : null}
        <Highlights items={store.highlights ?? []} brand={brand} />
        {brand.offer && <OfferRibbon offer={brand.offer} />}
        <DeliveryOptions store={store} inset={16} />
        <View style={styles.footer}>
          <View style={styles.footerMeta}>
            <View style={styles.whereRow}><Ionicons name="location-outline" size={14} color={colors.textSecondary} /><Text style={styles.where} numberOfLines={2}>{where}</Text></View>
            <OpenStatus store={store} />
          </View>
          <DirectionsButton store={store} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.border,
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  coverChips: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(15,23,42,0.72)", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  ratingText: { fontFamily: fonts.bold, fontSize: 12.5, color: "#fff" },
  stripe: { height: 4 },
  logo: {
    position: "absolute", top: COVER - LOGO / 2 - 3, left: 16, padding: 3, backgroundColor: "#fff", borderRadius: 20,
    shadowColor: "#0f172a", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  body: { paddingHorizontal: 16, paddingTop: 34, paddingBottom: 14, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: -0.3 },
  tagline: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary, marginTop: -4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.bold, fontSize: 12 },
  offer: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  offerText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.accentText },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  footerMeta: { flex: 1, gap: 4 },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  where: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
