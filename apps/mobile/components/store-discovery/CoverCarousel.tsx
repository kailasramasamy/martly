import { useState, type ReactNode } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import type { StoreBranding } from "./branding";

type StoreBanner = NonNullable<Store["banners"]>[number];
type Page = { key: string; uri: string; poster: boolean; banner?: StoreBanner };

interface CoverCarouselProps {
  store: Store;
  brand: StoreBranding;
  height: number;
  /** Chips laid over the top of every page (ETA, rating, current store) */
  overlay?: ReactNode;
  onBannerPress?: (banner: StoreBanner) => void;
  onPosterPress?: (uri: string) => void;
}

/** Store photo, then the home banners it runs (same 3:2 shape, so they fill the frame), then its posters shown whole */
function pagesOf(store: Store): Page[] {
  const cover = store.imageUrl ? [{ key: "cover", uri: store.imageUrl, poster: false }] : [];
  const banners = (store.banners ?? []).map((b) => ({ key: `banner-${b.id}`, uri: b.imageUrl, poster: false, banner: b }));
  const posters = (store.promoImages ?? []).map((uri, i) => ({ key: `poster-${i}`, uri, poster: true }));
  return [...cover, ...banners, ...posters];
}

/** The store's photo, banners and promo posters, swiped by hand; posters are shown whole on the brand colour, never cropped */
export function CoverCarousel({ store, brand, height, overlay, onBannerPress, onPosterPress }: CoverCarouselProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const pages = pagesOf(store);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => width && setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const offers = pages.filter((p) => p.key !== "cover").length;

  return (
    <View style={[styles.root, { height, backgroundColor: brand.tint }]} onLayout={onLayout}>
      {width > 0 && pages.length > 0 && (
        <FlatList
          horizontal
          pagingEnabled
          data={pages}
          keyExtractor={(p) => p.key}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEnabled={pages.length > 1}
          renderItem={({ item }) => {
            const { banner } = item;
            const onPress = banner && onBannerPress ? () => onBannerPress(banner) : item.poster && onPosterPress ? () => onPosterPress(item.uri) : undefined;
            return (
              <Pressable onPress={onPress} disabled={!onPress} style={{ width, height, backgroundColor: item.poster ? brand.color : undefined }}
                accessibilityRole={onPress ? "imagebutton" : "image"} accessibilityLabel={banner ? "Offer banner" : item.poster ? "Store poster" : "Store photo"}>
                <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode={item.poster ? "contain" : "cover"} />
              </Pressable>
            );
          }}
        />
      )}
      <LinearGradient colors={["rgba(15,23,42,0.35)", "transparent"]} style={[styles.shade, { height: height * 0.5 }]} pointerEvents="none" />
      <View style={styles.overlay} pointerEvents="none">{overlay}</View>
      {pages.length > 1 && (
        <View style={styles.footer} pointerEvents="none">
          {offers > 0 && index === 0 && <Text style={styles.hint}>Swipe for {offers} offer{offers === 1 ? "" : "s"}</Text>}
          <View style={styles.dots}>
            {pages.map((p, i) => <View key={p.key} style={[styles.dot, i === index && styles.dotActive]} />)}
          </View>
        </View>
      )}
    </View>
  );
}

/** Marks a store whose card carries promo posters */
export function OffersTag({ store }: { store: Store }) {
  if (!store.promoImages?.length) return null;
  return <Text style={styles.offersTag}>Offers</Text>;
}

const styles = StyleSheet.create({
  offersTag: {
    fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentText, backgroundColor: colors.accent,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: "hidden", textTransform: "uppercase", letterSpacing: 0.4,
  },
  root: { overflow: "hidden" },
  shade: { position: "absolute", top: 0, left: 0, right: 0 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0 },
  footer: { position: "absolute", right: 10, bottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  hint: { fontFamily: fonts.bold, fontSize: 11.5, color: "#fff", backgroundColor: "rgba(15,23,42,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: "hidden" },
  dots: { flexDirection: "row", gap: 4, backgroundColor: "rgba(15,23,42,0.45)", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 14 },
});
