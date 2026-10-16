import { useRef, type ReactNode } from "react";
import { ScrollView, TouchableOpacity, Text, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "./tokens";
import type { Anchor } from "./OptionDropdown";

export interface FilterChip {
  key: string;
  /** Shown while nothing is picked, e.g. "Brand" */
  label: string;
  /** The picked value's name; a chip with a value renders as active */
  value?: string;
  /** Gets the chip's window position, so a dropdown can open right below it */
  onPress: (anchor: Anchor) => void;
}

interface FilterChipBarProps {
  chips: FilterChip[];
  /** Number of filters applied, badged on the leading "all filters" button */
  activeCount: number;
  onOpenAll: (anchor: Anchor) => void;
  onClear: () => void;
}

interface ChipButtonProps {
  style: StyleProp<ViewStyle>;
  label: string;
  onPress: (anchor: Anchor) => void;
  children: ReactNode;
}

function ChipButton({ style, label, onPress, children }: ChipButtonProps) {
  const ref = useRef<View>(null);
  const press = () => ref.current?.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }));
  return (
    <TouchableOpacity ref={ref} style={style} onPress={press} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </TouchableOpacity>
  );
}

/** One scrolling row of dropdown chips: all-filters button, a chip per filter, and Clear once anything is applied */
export function FilterChipBar({ chips, activeCount, onOpenAll, onClear }: FilterChipBarProps) {
  const any = activeCount > 0;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      <ChipButton style={[styles.chip, any && styles.chipActive]} onPress={onOpenAll} label={`All filters, ${activeCount} applied`}>
        <Ionicons name="options-outline" size={17} color={any ? "#fff" : colors.text} />
        {any && <View style={styles.badge}><Text style={[styles.badgeText, tabular]}>{activeCount}</Text></View>}
      </ChipButton>
      {chips.map((c) => {
        const active = !!c.value;
        return (
          <ChipButton key={c.key} style={[styles.chip, active && styles.chipActive]} onPress={c.onPress} label={`${c.label}: ${c.value ?? "any"}`}>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{c.value ?? c.label}</Text>
            <Ionicons name="chevron-down" size={14} color={active ? "#fff" : colors.textSecondary} />
          </ChipButton>
        );
      })}
      {any && (
        <TouchableOpacity style={styles.clear} onPress={onClear} accessibilityRole="button">
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 36, minWidth: 44, justifyContent: "center", paddingHorizontal: 12,
    borderRadius: 18, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, maxWidth: 160 },
  labelActive: { color: "#fff", fontFamily: fonts.bold },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.primary },
  clear: { height: 36, minWidth: 44, justifyContent: "center", paddingHorizontal: 8 },
  clearText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
});
