import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import type { Store } from "../lib/types";

interface Props {
  store: Store | null;
  userArea: string | null;
  onPress: () => void;
}

// Home header: leads with the delivery promise once a store is chosen, otherwise with the user's area
export function HomeHeaderLocation({ store, userArea, onPress }: Props) {
  const eta = store?.expressEtaMinutes;
  const headline = store
    ? eta ? `Delivery in ${eta} minutes` : store.name
    : userArea ?? "Choose a store";
  const caption = store ? (eta ? store.name : "Delivering from") : "Delivering to";

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${caption}. Change store`}
    >
      <View style={[styles.icon, eta ? styles.iconFast : null]}>
        <Ionicons name={eta ? "flash" : "location-sharp"} size={18} color={eta ? "#b45309" : colors.primary} />
      </View>
      <View style={styles.text}>
        {eta ? (
          <>
            <Text style={styles.headline} numberOfLines={1}>{headline}</Text>
            <View style={styles.captionRow}>
              <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>{caption.toUpperCase()}</Text>
            <View style={styles.captionRow}>
              <Text style={styles.headlineSmall} numberOfLines={1}>{headline}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  icon: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center",
  },
  iconFast: { backgroundColor: "#fef3c7" },
  text: { flex: 1 },
  headline: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22, color: colors.text, letterSpacing: -0.3 },
  headlineSmall: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, flexShrink: 1 },
  captionRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: "#94a3b8" },
});
