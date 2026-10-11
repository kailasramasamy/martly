import { FlatList, Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import type { SearchFacets } from "../../lib/types";

const IMAGE_SIZE = 56;

export function formatTag(tag: string): string {
  const spaced = tag.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface TabItem {
  key: string | null;
  label: string;
  imageUrl: string | null;
}

interface SearchTagTabsProps {
  tags: SearchFacets["tags"];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
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

export function SearchTagTabs({ tags, activeTag, onSelect }: SearchTagTabsProps) {
  if (tags.length < 2) return null;
  const items: TabItem[] = [
    { key: null, label: "All", imageUrl: null },
    ...tags.map((t) => ({ key: t.tag, label: formatTag(t.tag), imageUrl: t.imageUrl })),
  ];
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => i.key ?? "all"}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <TagTab item={item} active={item.key === activeTag} onPress={() => onSelect(item.key)} />}
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
