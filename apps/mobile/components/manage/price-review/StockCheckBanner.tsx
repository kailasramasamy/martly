import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { StockCheckSummary } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { manage, tabular } from "../ui/tokens";

/** Pricing products the store doesn't carry is wasted work, so unconfirmed range points to Stock check first */
export function StockCheckBanner({ storeId }: { storeId: string }) {
  const router = useRouter();
  const { data } = useResource<StockCheckSummary>(`/api/v1/stock-check/summary?storeId=${storeId}`);
  if (!data?.unchecked) return null;
  return (
    <TouchableOpacity style={styles.banner} onPress={() => router.push("/manage/stock-check")} activeOpacity={0.8} accessibilityRole="button">
      <View style={styles.icon}><Ionicons name="checkbox-outline" size={18} color={manage.attentionText} /></View>
      <View style={styles.body}>
        <Text style={styles.title}>Confirm what you stock first</Text>
        <Text style={[styles.sub, tabular]}>{data.unchecked.toLocaleString("en-IN")} products to confirm in Stock check</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={manage.attentionText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, padding: 12, borderRadius: radius.lg, backgroundColor: manage.attentionBg },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  body: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.attentionText, marginTop: 1 },
});
