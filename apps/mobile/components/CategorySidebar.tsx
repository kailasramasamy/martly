import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { getCategoryIcon } from "../constants/category-icons";
import { useLanguage } from "../lib/language-context";

const SIDEBAR_WIDTH = Math.round(Dimensions.get("window").width * 0.21);

export interface SidebarSubcategory {
  id: string;
  name: string;
  imageUrl: string | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
}

interface Props {
  subcategories: SidebarSubcategory[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

function SidebarItem({ label, active, onPress, children }: { label: string; active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.imageWrap, active && styles.imageWrapActive]}>{children}</View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Instamart-style subcategory rail: floating images, a tinted block behind the active one. */
export function CategorySidebar({ subcategories, activeId, onSelect }: Props) {
  const { getLocalizedName } = useLanguage();
  return (
    <ScrollView style={styles.sidebar} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SidebarItem label="All" active={!activeId} onPress={() => onSelect(null)}>
        <Ionicons name="grid-outline" size={26} color={!activeId ? colors.primary : "#94a3b8"} />
      </SidebarItem>
      {subcategories.map((sub) => (
        <SidebarItem key={sub.id} label={getLocalizedName(sub)} active={activeId === sub.id} onPress={() => onSelect(sub.id)}>
          {sub.imageUrl ? (
            <Image source={{ uri: sub.imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <Ionicons name={getCategoryIcon(sub.name)} size={24} color={activeId === sub.id ? colors.primary : "#94a3b8"} />
          )}
        </SidebarItem>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: SIDEBAR_WIDTH, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surface },
  content: { paddingVertical: 6 },
  item: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 4 },
  imageWrap: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  imageWrapActive: { backgroundColor: "#d9f3ee" },
  image: { width: 54, height: 54 },
  label: {
    marginTop: 4, fontFamily: fonts.medium, fontSize: 12, lineHeight: 15,
    color: colors.textSecondary, textAlign: "center", letterSpacing: 0,
  },
  labelActive: { fontFamily: fonts.bold, color: colors.text },
});
