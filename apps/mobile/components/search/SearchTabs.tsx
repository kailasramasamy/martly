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
}

// Subcategories when the matches span several ("oil" → Sunflower, Groundnut…), else the product tags
function tabItems({ subcategories, tags }: SearchFacets): TabItem[] {
  if (subcategories.length >= 2) {
    return subcategories.map((s) => ({ tab: { kind: "subcategory", key: s.id }, label: s.name, imageUrl: s.imageUrl }));
  }
  if (tags.length >= 2) {
    return tags.map((t) => ({ tab: { kind: "tag", key: t.tag }, label: formatTag(t.tag), imageUrl: t.imageUrl }));
  }
  return [];
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

export function SearchTabs({ facets, active, onSelect }: SearchTabsProps) {
  const tabs = tabItems(facets);
  if (tabs.length === 0) return null;
  const items: TabItem[] = [{ tab: null, label: "All", imageUrl: null }, ...tabs];
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => i.tab?.key ?? "all"}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <TagTab item={item} active={item.tab?.key === active?.key} onPress={() => onSelect(item.tab)} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: { width: 76, alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent" },
  tabActive: { borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  imageWrap: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  label: { marginTop: 4, fontFamily: fonts.medium, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: "center" },
  labelActive: { fontFamily: fonts.extrabold, color: colors.primaryDark },
});
