import { Fragment } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

export interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Right-aligned value, e.g. the selected language */
  value?: string;
  onPress: () => void;
  /** Mart Plus and other premium entries use the amber accent */
  premium?: boolean;
}

export function MenuGroup({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.group}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <View style={styles.divider} />}
            <TouchableOpacity style={styles.row} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[styles.icon, item.premium && styles.iconPremium]}>
                <Ionicons name={item.icon} size={18} color={item.premium ? "#b45309" : colors.primary} />
              </View>
              <Text style={styles.label}>{item.label}</Text>
              {item.value ? <Text style={styles.value}>{item.value}</Text> : null}
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 22 },
  title: {
    fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary, letterSpacing: 0.6,
    textTransform: "uppercase", marginBottom: 8, marginLeft: 4,
  },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 56 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  iconPremium: { backgroundColor: "#fef3c7" },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  value: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginLeft: 62 },
});
