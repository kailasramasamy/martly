import { View, Text, StyleSheet } from "react-native";
import { PhoneFrame } from "./PhoneFrame";
import {
  Bar, Box, BrandMark, BrandSlide, CreativeFill, BRAND_COLOR, BRAND_TINT, Dots, FestiveHero, Highlight, HomeHeader, ProductTile, SectionTitle, TileRow,
} from "./primitives";
import { usePreviewBrand } from "./preview-context";
import { colors, fonts } from "../../../../constants/theme";

/** Home with the carousel slide highlighted, just below the category directory */
export function HomeCarouselMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <FestiveHero />
      <View style={styles.pad}>
        <SectionTitle />
        <TileRow />
        <Highlight style={styles.gap}><BrandSlide /></Highlight>
        <Dots />
      </View>
    </PhoneFrame>
  );
}

function Poster({ brand }: { brand?: boolean }) {
  const { creativeUrl } = usePreviewBrand();
  const poster = (
    <View style={[styles.poster, brand && styles.posterBrand]}>
      {brand && creativeUrl ? <CreativeFill /> : brand ? <><BrandMark size={30} round /><Bar w="70%" h={5} style={styles.posterBar} /><Bar w="45%" h={4} style={styles.posterBar} /></> : <Box h={96} />}
    </View>
  );
  return brand ? <Highlight style={styles.posterRing}>{poster}</Highlight> : poster;
}

/** Home scrolled down: a product row, then the Brand posters rail */
export function HomePosterMockup() {
  return (
    <PhoneFrame>
      <View style={[styles.pad, { paddingTop: 8 }]}>
        <SectionTitle w={80} />
        <TileRow />
        <SectionTitle w={96} />
        <View style={styles.rail}>
          <Poster />
          <Poster brand />
          <Poster />
        </View>
      </View>
    </PhoneFrame>
  );
}

function OfferCard() {
  const { offLabel, brandName } = usePreviewBrand();
  return (
    <View style={styles.offer}>
      <View style={styles.offerHead}>
        <BrandMark size={22} />
        <View style={{ flex: 1, gap: 3 }}><Bar w="70%" h={5} style={{ backgroundColor: BRAND_COLOR }} /><Text style={styles.offerOff} numberOfLines={1}>{offLabel ?? "10% OFF"} on {brandName ?? "BRAND"}</Text></View>
      </View>
      <View style={styles.offerRow}>
        {[0, 1, 2].map((i) => <View key={i} style={styles.offerTile}><ProductTile brand imageHeight={26} /></View>)}
      </View>
    </View>
  );
}

/** Home with the carousel slide and a shoppable offer card highlighted */
export function HomePromotionMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <View style={styles.pad}>
        <Highlight style={styles.gap}><BrandSlide height={66} /></Highlight>
        <Dots />
        <SectionTitle />
        <Highlight style={styles.cardGap}><OfferCard /></Highlight>
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  offerTile: { flex: 1 },
  pad: { paddingHorizontal: 8, paddingTop: 8, gap: 5 },
  gap: { marginTop: 6 },
  cardGap: { marginTop: 6 },
  rail: { flexDirection: "row", gap: 6 },
  poster: { width: 64, height: 96, borderRadius: 8, overflow: "hidden" },
  posterBrand: { backgroundColor: BRAND_COLOR, alignItems: "center", justifyContent: "center", gap: 5 },
  posterBar: { backgroundColor: "rgba(255,255,255,0.85)" },
  posterRing: { borderRadius: 10 },
  offer: { backgroundColor: BRAND_TINT, borderRadius: 10, padding: 6, gap: 6 },
  offerHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  offerOff: { fontFamily: fonts.extrabold, fontSize: 8, color: colors.text },
  offerRow: { flexDirection: "row", gap: 4 },
});
