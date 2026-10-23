import { useState } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { PosterViewer } from "./PosterViewer";
import { BANNER_ASPECT } from "../HeroBannerSlide";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import { useStoreBranding, type StoreBranding } from "./branding";
import { OpenStatus } from "./StoreCards";
import { StoreLogo } from "./StoreLogo";
import { CoverCarousel } from "./CoverCarousel";
import { DeliveryOptions } from "./DeliveryOptions";
import { distanceText, getStoreArea } from "./store-info";
import { DirectionsButton } from "./DirectionsButton";

// Same shape as the home screen's banners so they show whole; the carousel sits inside the card's 16px padding
const COVER = Math.round((Dimensions.get("window").width - 64) / BANNER_ASPECT);
const LOGO = 44;

function Rating({ store }: { store: Store }) {
  if (!(store.ratingCount ?? 0) || store.ratingAvg == null) return null;
  return (
    <View style={styles.rating}>
      <Ionicons name="star" size={12} color={colors.accent} />
      <Text style={styles.ratingText}>{store.ratingAvg.toFixed(1)}</Text>
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
  return <Text style={[styles.highlights, { color: textColor }]} numberOfLines={2}>{items.join("  ·  ")}</Text>;
}

/** Everything about one store: who it is, whether it's open and how fast, best offer, delivery, then its photo and promo posters */
export type StoreBanner = NonNullable<Store["banners"]>[number];

export function StoreDetailPanel({ store, onBannerPress }: { store: Store; onBannerPress: (store: Store, banner: StoreBanner) => void }) {
  const [poster, setPoster] = useState<string | null>(null);
  const brand = useStoreBranding(store);
  const where = [getStoreArea(store), distanceText(store)].filter(Boolean).join("  ·  ");
  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: brand.color }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <StoreLogo store={store} brand={brand} size={LOGO} />
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{brand.name}</Text>
            <Rating store={store} />
          </View>
          <DirectionsButton store={store} />
        </View>
        {brand.tagline ? <Text style={styles.tagline} numberOfLines={2}>{brand.tagline}</Text> : null}
        <OpenStatus store={store} />
        {where ? <View style={styles.whereRow}><Ionicons name="location-outline" size={14} color={colors.textSecondary} /><Text style={styles.where} numberOfLines={2}>{where}</Text></View> : null}
        <Highlights items={store.highlights ?? []} brand={brand} />
        {brand.offer && <OfferRibbon offer={brand.offer} />}
        <DeliveryOptions store={store} inset={16} />
        <View style={styles.cover}>
          <CoverCarousel store={store} brand={brand} height={COVER} onBannerPress={(b) => onBannerPress(store, b)} onPosterPress={setPoster} />
        </View>
        <PosterViewer uri={poster} onClose={() => setPoster(null)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border,
    shadowColor: "#0f172a", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fef3c7", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  ratingText: { fontFamily: fonts.bold, fontSize: 12, color: colors.accentText },
  stripe: { height: 4 },
  body: { padding: 16, paddingTop: 14, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  nameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.3 },
  tagline: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -4 },
  where: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  cover: { borderRadius: 14, overflow: "hidden", marginTop: 2 },
  highlights: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  offer: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  offerText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.accentText },
});
