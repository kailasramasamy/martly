import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

// Compact membership upsell for non-members (members see their status chip at the top instead)
export function PlusPromoStrip() {
  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.9 }]}
      onPress={() => router.push("/membership")}
      accessibilityRole="button"
      accessibilityLabel="Join Mart Plus for free delivery and bonus loyalty points"
    >
      <LinearGradient colors={["#fef3c7", "#fde68a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.strip}>
        <View style={styles.badge}>
          <Ionicons name="diamond" size={16} color={colors.accentText} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Mart Plus</Text>
          <Text style={styles.subtitle} numberOfLines={1}>Free delivery + bonus loyalty on every order</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Join</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 16 },
  strip: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#fcd34d",
  },
  badge: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  text: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.accentText },
  subtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: "#78350f", marginTop: 1 },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: colors.accentText, borderRadius: 16, paddingHorizontal: 12, height: 32,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
});
