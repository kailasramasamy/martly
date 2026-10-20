import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DirectoryCategory, DirectoryDepartment } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { wordmarkColors } from "../../lib/brand-strip";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";

interface ChipsProps {
  departments: DirectoryDepartment[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

function Chip({ label, icon, tint, active, onPress }: {
  label: string; icon: ReturnType<typeof getCategoryIcon>; tint: [string, string]; active: boolean; onPress: () => void;
}) {
  const [background, ink] = tint;
  return (
    <Pressable
      style={[styles.chip, { backgroundColor: active ? ink : background }]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={15} color={active ? "#fff" : ink} />
      <Text style={[styles.chipText, { color: active ? "#fff" : ink }]}>{label}</Text>
    </Pressable>
  );
}

// Sticky department filter: every chip wears its department's colour, solid when picked
export function DepartmentChips({ departments, activeId, onSelect }: ChipsProps) {
  const { getLocalizedName } = useLanguage();
  const t = useStrings("catalog");
  return (
    <View style={styles.chipsBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t.all} icon="apps" tint={["#ccfbf1", colors.primary]} active={activeId === null} onPress={() => onSelect(null)} />
        {departments.map((d) => (
          <Chip
            key={d.id} label={getLocalizedName(d)} icon={getCategoryIcon(d.name)} tint={wordmarkColors(d.name)}
            active={activeId === d.id} onPress={() => onSelect(d.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// Full-width colour band that opens a department when "All" is showing
export function DepartmentBand({ department, brandCount }: { department: DirectoryDepartment; brandCount: number }) {
  const { getLocalizedName } = useLanguage();
  const t = useStrings("catalog");
  const [background, ink] = wordmarkColors(department.name);
  return (
    <View style={[styles.band, { backgroundColor: background }]}>
      <View style={[styles.bandIcon, { backgroundColor: ink }]}>
        <Ionicons name={getCategoryIcon(department.name)} size={18} color="#fff" />
      </View>
      <Text style={[styles.bandTitle, { color: ink }]} numberOfLines={1}>{getLocalizedName(department)}</Text>
      <Text style={[styles.bandCount, { color: ink }]}>{t.brands.bandCount(brandCount)}</Text>
    </View>
  );
}

export function CategoryHeader({ category, departmentName, brandCount }: { category: DirectoryCategory; departmentName: string; brandCount: number }) {
  const { getLocalizedName } = useLanguage();
  const t = useStrings("catalog");
  const [, ink] = wordmarkColors(departmentName);
  return (
    <View style={styles.catHeader}>
      <View style={[styles.catBar, { backgroundColor: ink }]} />
      <Text style={styles.catTitle} numberOfLines={1}>{getLocalizedName(category)}</Text>
      <Text style={styles.catCount}>{t.brands.count(brandCount)}</Text>
    </View>
  );
}

export function ViewAllButton({ hidden, onPress }: { hidden: number; onPress: () => void }) {
  const t = useStrings("catalog");
  return (
    <Pressable style={styles.more} onPress={onPress} accessibilityRole="button">
      <Text style={styles.moreText}>{t.brands.viewMore(hidden)}</Text>
      <Ionicons name="chevron-down" size={15} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipsBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18 },
  chipText: { fontFamily: fonts.bold, fontSize: 13 },
  band: {
    flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 22,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16,
  },
  bandIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  bandTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: -0.3 },
  bandCount: { fontFamily: fonts.bold, fontSize: 12, opacity: 0.75 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  catBar: { width: 4, height: 18, borderRadius: 2 },
  catTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text, letterSpacing: -0.2 },
  catCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  more: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44,
    marginHorizontal: 16, marginTop: 2, borderRadius: 12, backgroundColor: "#f0fdfa",
  },
  moreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
