import { useEffect, useRef } from "react";
import { FlatList, Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import type { SearchFacets } from "../../lib/types";
import type { SearchTab } from "../../lib/use-product-search";

const IMAGE_SIZE = 56;

export function formatTag(tag: string): string {
  const spaced = tag.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface TabItem {
  tab: SearchTab | null;
  label: string;
  imageUrl: string | null;
}

interface SearchTabsProps {
  facets: SearchFacets;
  active: SearchTab | null;
  onSelect: (tab: SearchTab | null) => void;
  compact?: boolean;
  // Off-screen copy (the other header mode): keep it centred on the selection for when it's revealed
  hidden?: boolean;
}

// Subcategories when the matches span several ("oil" → Sunflower, Groundnut…), else the product tags
function tabItems({ subcategories, tags }: SearchFacets): TabItem[] {
  if (subcategories.length >= 2) {
    return subcategories.map((s) => ({ tab: { kind: "subcategory", key: s.id }, label: s.label, imageUrl: s.imageUrl }));
  }
  if (tags.length >= 2) {
    return tags.map((t) => ({ tab: { kind: "tag", key: t.tag }, label: formatTag(t.tag), imageUrl: t.imageUrl }));
  }
  return [];
}

// Full name for messages ("Finding Detergent Powder…"); the tab itself shows the short label
export function tabLabel(facets: SearchFacets, tab: SearchTab): string {
  if (tab.kind === "subcategory") return facets.subcategories.find((s) => s.id === tab.key)?.name ?? tab.key;
  return formatTag(tab.key);
}

// Text-only pill used once the results are scrolled and the header collapses
function CompactTab({ item, active, onPress }: { item: TabItem; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.pill, active && styles.pillActive]} onPress={onPress} accessibilityState={{ selected: active }}>
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}

function TagTab({ item, active, onPress }: { item: TabItem; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} accessibilityState={{ selected: active }}>
      <View style={styles.imageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Ionicons name="grid-outline" size={26} color={colors.primary} />
        )}
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>{item.label}</Text>
    </TouchableOpacity>
  );
}

export function SearchTabs({ facets, active, onSelect, compact = false, hidden = false }: SearchTabsProps) {
  const listRef = useRef<FlatList<TabItem>>(null);
  const tabs = tabItems(facets);
  const items: TabItem[] = [{ tab: null, label: "All", imageUrl: null }, ...tabs];
  const activeIndex = items.findIndex((i) => i.tab?.key === active?.key);

  useEffect(() => {
    if (!hidden || activeIndex < 0 || tabs.length === 0) return;
    const t = setTimeout(() => listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.5, animated: false }), 0);
    return () => clearTimeout(t);
  }, [hidden, activeIndex, tabs.length]);

  if (tabs.length === 0) return null;
  const Tab = compact ? CompactTab : TagTab;
  return (
    <FlatList
      ref={listRef}
      initialNumToRender={items.length}
      onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }), 50)}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => i.tab?.key ?? "all"}
      contentContainerStyle={compact ? styles.compactRow : styles.row}
      renderItem={({ item }) => <Tab item={item} active={item.tab?.key === active?.key} onPress={() => onSelect(item.tab)} />}
      style={[styles.list, compact && styles.compactList]}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  compactList: { borderBottomWidth: 1, borderBottomColor: colors.border },
  compactRow: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.xs },
  pill: { height: 36, justifyContent: "center", paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  pillLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  pillLabelActive: { color: "#fff" },
  tab: { width: 76, alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent" },
  tabActive: { borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  imageWrap: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  label: { marginTop: 4, fontFamily: fonts.medium, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: "center" },
  labelActive: { fontFamily: fonts.extrabold, color: colors.primaryDark },
});
