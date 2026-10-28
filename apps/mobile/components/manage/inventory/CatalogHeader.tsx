import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { SearchField } from "../ui/SearchField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { FacetChips, type Facet } from "../ui/FacetChips";
import { StockTiles } from "./StockTiles";
import { CatalogShortcuts } from "./CatalogShortcuts";
import { SetupTasks } from "./SetupTasks";
import { CountsWaitingCard } from "../stock/CountsWaitingCard";
import { useWaitingCountStatus } from "../../../lib/manage/use-counts-waiting";
import { useManageScope } from "../../../lib/manage-scope-context";
import type { CatalogFilter, StockSummary } from "./types";

interface CatalogHeaderProps {
  summary: StockSummary | null;
  search: string;
  onSearch: (q: string) => void;
  filter: CatalogFilter;
  onFilter: (f: CatalogFilter) => void;
  facets: Facet[] | undefined;
  facet: string | null;
  onFacet: (id: string | null) => void;
  /** Search took focus and the overview above it collapsed; the list should return to its top */
  onSearchFocus: () => void;
}

export function CatalogHeader({ summary, search, onSearch, filter, onFilter, facets, facet, onFacet, onSearchFocus }: CatalogHeaderProps) {
  const low = summary?.totals.lowStock;
  const out = summary?.totals.outOfStock;
  const [searching, setSearching] = useState(false);
  const { storeId } = useManageScope();
  // Counters land here, so recounts sent back to them show first; approvers see theirs on Today
  const recountWaiting = useWaitingCountStatus() === "RECOUNT";
  // While searching, the overview gets out of the way so results sit right under the field, above the keyboard
  const compact = searching || !!search;
  return (
    <View style={styles.root}>
      {!compact && recountWaiting && <CountsWaitingCard storeId={storeId} />}
      {!compact && storeId && <SetupTasks storeId={storeId} />}
      {!compact && <StockTiles summary={summary} />}
      {!compact && <CatalogShortcuts />}
      {!compact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Listed at this store{summary ? ` \u00B7 ${summary.totals.totalSKUs.toLocaleString("en-IN")}` : ""}
          </Text>
          <Text style={styles.sectionHint}>Tap a product to update its stock, price or visibility here</Text>
        </View>
      )}
      <SearchField value={search} onChange={onSearch} placeholder="Search this store's products" onFocusChange={(focused) => {
        setSearching(focused);
        if (focused) onSearchFocus();
      }} />
      <SegmentedTabs
        value={filter}
        onChange={onFilter}
        options={[
          { value: "all", label: "All" },
          { value: "low", label: "Low stock", count: low || undefined },
          { value: "out", label: "Out of stock", count: out || undefined },
          { value: "unlisted", label: "Unlisted" },
          { value: "featured", label: "Featured" },
        ]}
      />
      {search ? <FacetChips facets={facets} value={facet} onChange={onFacet} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  section: { marginTop: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase" },
  sectionHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 3 },
});
