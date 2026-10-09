import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchSortBy, SearchSortLabels } from "@martly/shared/constants";
import { colors, fonts, spacing } from "../../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

interface Pill {
  key: string;
  label: string;
  icon?: IconName;
  chevron?: boolean;
  badge?: number;
  active?: boolean;
  onPress: () => void;
}

interface SearchControlBarProps {
  filterCount: number;
  sortBy: SearchSortBy;
  size: string | null;
  offers: boolean;
  offerCount: number;
  hasSizes: boolean;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onOpenQuantity: () => void;
  onToggleOffers: () => void;
}

function buildPills(p: SearchControlBarProps): Pill[] {
  const pills: Pill[] = [
    { key: "filters", label: "Filters", icon: "options-outline", chevron: true, badge: p.filterCount, active: p.filterCount > 0, onPress: p.onOpenFilters },
    {
      key: "sort",
      label: p.sortBy === SearchSortBy.RELEVANCE ? "Sort" : SearchSortLabels[p.sortBy],
      icon: "swap-vertical-outline",
      chevron: true,
      active: p.sortBy !== SearchSortBy.RELEVANCE,
      onPress: p.onOpenSort,
    },
  ];
  if (p.hasSizes) {
    pills.push({ key: "quantity", label: p.size ?? "Quantity", chevron: true, active: p.size != null, onPress: p.onOpenQuantity });
  }
  if (p.offerCount > 0 || p.offers) {
    pills.push({ key: "offers", label: "Offers", icon: "pricetag-outline", active: p.offers, onPress: p.onToggleOffers });
  }
  return pills;
}

function PillButton({ pill }: { pill: Pill }) {
  const fg = pill.key === "offers" && pill.active ? "#fff" : pill.active ? colors.primary : colors.text;
  return (
    <TouchableOpacity
      style={[styles.pill, pill.active && (pill.key === "offers" ? styles.pillFilled : styles.pillActive)]}
      onPress={pill.onPress}
      accessibilityState={{ selected: pill.active }}
    >
      {pill.icon && <Ionicons name={pill.icon} size={16} color={fg} />}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{pill.label}</Text>
      {!!pill.badge && (
        <View style={styles.badge}><Text style={styles.badgeText}>{pill.badge}</Text></View>
      )}
      {pill.chevron && <Ionicons name="chevron-down" size={14} color={fg} />}
    </TouchableOpacity>
  );
}

export function SearchControlBar(props: SearchControlBarProps) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={buildPills(props)}
      keyExtractor={(p) => p.key}
      contentContainerStyle={styles.row}
      style={styles.list}
      renderItem={({ item }) => <PillButton pill={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  pill: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14,
    borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  pillActive: { borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  pillFilled: { borderColor: colors.primary, backgroundColor: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 13, maxWidth: 150 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: "#fff" },
});
