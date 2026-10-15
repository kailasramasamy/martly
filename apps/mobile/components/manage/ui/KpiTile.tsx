import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "./tokens";
import { Sparkline } from "./Sparkline";

interface KpiTileProps {
  label: string;
  value: string;
  /** Percent change vs previous period; omitted when there is no comparison */
  deltaPct?: number | null;
  trend?: number[];
  onPress?: () => void;
}

export function KpiTile({ label, value, deltaPct, trend, onPress }: KpiTileProps) {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} disabled={!onPress} activeOpacity={0.75}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, tabular]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <View style={styles.footer}>
        {deltaPct != null ? (
          <View style={styles.delta}>
            <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? "#15803d" : colors.error} />
            <Text style={[styles.deltaText, tabular, { color: up ? "#15803d" : colors.error }]}>
              {Math.abs(deltaPct).toFixed(0)}%
            </Text>
          </View>
        ) : <View />}
        {trend && trend.length > 1 && <View style={styles.spark}><Sparkline values={trend} height={18} /></View>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 96, backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 12 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  value: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, marginTop: 6, letterSpacing: -0.4 },
  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 8 },
  delta: { flexDirection: "row", alignItems: "center", gap: 2 },
  deltaText: { fontFamily: fonts.bold, fontSize: 12 },
  spark: { width: 56 },
});
