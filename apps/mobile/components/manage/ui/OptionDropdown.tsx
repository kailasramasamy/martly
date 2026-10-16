import { Modal, Pressable, ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "./tokens";
import type { SelectOption } from "./OptionSheet";

/** Where the control that opened the dropdown sits, in window coordinates */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OptionDropdownProps {
  anchor: Anchor | null;
  options: SelectOption[];
  value: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
}

const WIDTH = 248;
const GUTTER = 16;

/** Single-choice menu dropped right below its chip; tapping outside closes it */
export function OptionDropdown({ anchor, options, value, onPick, onClose }: OptionDropdownProps) {
  const window = useWindowDimensions();
  if (!anchor) return null;
  const top = anchor.y + anchor.height + 6;
  const left = Math.max(GUTTER, Math.min(anchor.x, window.width - WIDTH - GUTTER));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.menu, { top, left, maxHeight: window.height - top - 48 }]}>
        <ScrollView keyboardDismissMode="on-drag" bounces={false}>
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[styles.option, i > 0 && styles.divider]}
                onPress={() => onPick(o.value)}
                activeOpacity={0.7}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.label, selected && styles.selected]} numberOfLines={1}>{o.label}</Text>
                {o.count !== undefined && <Text style={[styles.count, tabular]}>{o.count}</Text>}
                {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute", width: WIDTH, borderRadius: 12, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line,
    paddingVertical: 4, shadowColor: "#0f172a", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  option: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: manage.hairline },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  selected: { color: colors.primary, fontFamily: fonts.bold },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
});
