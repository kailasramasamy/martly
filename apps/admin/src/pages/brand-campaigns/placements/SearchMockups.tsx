import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, Highlight, SearchBar } from "./primitives";
import { TileGrid, fill, type TileSpec } from "./ListingMockups";
import { T, V, WEIGHT, row } from "./ui";

function SearchResults({ tiles }: { tiles: TileSpec[] }) {
  return (
    <PhoneFrame>
      <V style={{ padding: 8, gap: 6 }}>
        <SearchBar text="milk" />
        <Bar w={70} h={5} style={{ backgroundColor: "#cbd5e1" }} />
        <TileGrid tiles={tiles} imageHeight={32} />
      </V>
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
  const content = (
    <V style={{ ...row, alignItems: "center", gap: 7, padding: sponsored ? "5px 6px" : "5px 4px" }}>
      {sponsored ? <BrandMark size={22} /> : <V style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "#f1f5f9" }} />}
      <V style={{ flex: "1 1 0%", gap: 3 }}>
        <Bar w="65%" h={5} style={sponsored ? { backgroundColor: "#94a3b8" } : undefined} />
        <Bar w="35%" h={3.5} />
      </V>
      {sponsored ? (
        <V style={{ backgroundColor: "#94a3b8", borderRadius: 3, padding: "1px 4px" }}>
          <T style={{ fontWeight: WEIGHT.bold, fontSize: 7, color: "#ffffff" }}>Ad</T>
        </V>
      ) : null}
    </V>
  );
  return sponsored ? <Highlight style={{ borderRadius: 10, margin: "3px 0" }}>{content}</Highlight> : content;
}

/** Suggestion panel under the search bar with one sponsored row */
export function SearchSuggestionsMockup() {
  return (
    <PhoneFrame>
      <V style={{ padding: 8, gap: 6 }}>
        <SearchBar text="mi" />
        <V style={{ gap: 4, marginTop: 4 }}>
          <SuggestionRow />
          <SuggestionRow sponsored />
          <SuggestionRow />
          <SuggestionRow />
          <SuggestionRow />
        </V>
      </V>
    </PhoneFrame>
  );
}
