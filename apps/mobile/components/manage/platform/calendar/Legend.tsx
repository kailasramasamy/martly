import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import type { Campaign } from "../types";
import { campaignColor } from "./package-colors";

/** One dot per package type present in the filtered campaigns, on a single line that scrolls sideways */
export function Legend({ campaigns }: { campaigns: Campaign[] }) {
  const entries = useMemo(() => {
    const byName = new Map(campaigns.map((c) => [c.product.name, campaignColor(c)]));
    return [...byName].sort(([a], [b]) => a.localeCompare(b));
  }, [campaigns]);
  if (!entries.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {entries.map(([name, color]) => (
        <View key={name} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.text}>{name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 14, paddingHorizontal: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
