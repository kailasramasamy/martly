import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";
import { MIN_BRANDS_FOR_STRIP, brandDisplayName, type BrandTile } from "../lib/brand-strip";
import { BrandFilterRow } from "./search/BrandFilterRow";

interface BrandFilterProps {
  brands: BrandTile[];
  selectedIds: string[];
}

/** Whether a listing has enough brands to filter by, or a brand filter is already on */
export const showsBrandFilter = ({ brands, selectedIds }: BrandFilterProps) => brands.length >= MIN_BRANDS_FOR_STRIP || selectedIds.length > 0;

/** The Brands chip beside On sale and Price: it names the picked brand, or counts them, and opens the full list */
export function BrandChip({ brands, selectedIds, onPress }: BrandFilterProps & { onPress: () => void }) {
  const t = useStrings("search");
  if (!showsBrandFilter({ brands, selectedIds })) return null;
  const one = selectedIds.length === 1 ? brands.find((b) => b.id === selectedIds[0]) : undefined;
  const label = one ? brandDisplayName(one.name) : selectedIds.length > 1 ? `${t.brands} · ${selectedIds.length}` : t.brands;
  const active = selectedIds.length > 0;
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={13} color={active ? "#fff" : "#64748b"} />
    </TouchableOpacity>
  );
}

/**
 * Above the products: the listing's brands as logos, a tap showing just that brand, and the brand's own store
 * once exactly one is picked
 */
export function BrandHeader({ brands, selectedIds, onChange, onVisit, bleed = 0 }: BrandFilterProps & {
  onChange: (ids: string[]) => void;
  onVisit?: (brand: BrandTile) => void;
  /** The list's side padding: the logo row runs edge to edge and pads itself */
  bleed?: number;
}) {
  const t = useStrings("home");
  const one = selectedIds.length === 1 ? brands.find((b) => b.id === selectedIds[0]) : undefined;
  return (
    <View>
      <View style={{ marginHorizontal: -bleed }}>
        <BrandFilterRow brands={brands} selectedIds={selectedIds} onChange={onChange} />
      </View>
      {one && onVisit && (
        <TouchableOpacity style={styles.visit} onPress={() => onVisit(one)} activeOpacity={0.7} accessibilityRole="link">
          <Text style={styles.visitText}>{t.visitBrandStore(brandDisplayName(one.name))}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row", height: 30, maxWidth: 160, alignItems: "center", gap: 4, paddingHorizontal: 10,
    borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { flexShrink: 1, fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  visit: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 36, marginBottom: 4 },
  visitText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
