import { View, Text, StyleSheet } from "react-native";
import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, Highlight, SearchBar } from "./primitives";
import { TileGrid, fill, type TileSpec } from "./ListingMockups";
import { fonts } from "../../../../constants/theme";

function SearchResults({ tiles }: { tiles: TileSpec[] }) {
  return (
    <PhoneFrame>
      <View style={styles.body}>
        <SearchBar text="milk" />
        <Bar w={70} h={5} style={styles.count} />
        <TileGrid tiles={tiles} imageHeight={32} />
      </View>
    </PhoneFrame>
  );
}

/** Search results with the sponsored product in slot 1 */
export function SearchSponsoredMockup() {
  return <SearchResults tiles={fill(8, { 0: { brand: true, badge: "Ad", lit: true } })} />;
}

/** Search results where the featured brand's products rank ahead */
export function SearchFeaturedMockup() {
  const featured: TileSpec = { brand: true, badge: "Featured", lit: true };
  return <SearchResults tiles={fill(8, { 0: featured, 1: featured, 2: featured })} />;
}

function SuggestionRow({ sponsored }: { sponsored?: boolean }) {
  const row = (
    <View style={[styles.row, sponsored && styles.rowSponsored]}>
      {sponsored ? <BrandMark size={22} /> : <View style={styles.thumb} />}
      <View style={{ flex: 1, gap: 3 }}>
        <Bar w="65%" h={5} style={sponsored ? { backgroundColor: "#94a3b8" } : undefined} />
        <Bar w="35%" h={3.5} />
      </View>
      {sponsored ? <View style={styles.adTag}><Text style={styles.adText}>Ad</Text></View> : null}
    </View>
  );
  return sponsored ? <Highlight style={styles.litRow}>{row}</Highlight> : row;
}

/** Suggestion panel under the search bar with one sponsored row */
export function SearchSuggestionsMockup() {
  return (
    <PhoneFrame>
      <View style={styles.body}>
        <SearchBar text="mi" />
        <View style={styles.panel}>
          <SuggestionRow />
          <SuggestionRow sponsored />
          <SuggestionRow />
          <SuggestionRow />
          <SuggestionRow />
        </View>
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: 8, gap: 6 },
  count: { backgroundColor: "#cbd5e1" },
  panel: { gap: 4, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 5, paddingHorizontal: 4 },
  rowSponsored: { paddingHorizontal: 6 },
  litRow: { borderRadius: 10, marginVertical: 3 },
  thumb: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#f1f5f9" },
  adTag: { backgroundColor: "#94a3b8", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  adText: { fontFamily: fonts.bold, fontSize: 7, color: "#ffffff" },
});

