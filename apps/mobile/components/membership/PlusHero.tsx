import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

const PLUS_GRADIENT = ["#134e4a", colors.primary] as const;

function HeroPerk({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.perk}>
      <View style={styles.perkIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.perkLabel}>{label}</Text>
    </View>
  );
}

export function PlusHero({ maxPointsMultiplier }: { maxPointsMultiplier: number }) {
  return (
    <LinearGradient colors={PLUS_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={[styles.orb, styles.orbLarge]} />
      <View style={[styles.orb, styles.orbSmall]} />
      <View style={styles.badge}>
        <Ionicons name="diamond" size={14} color={colors.accentText} />
        <Text style={styles.badgeText}>MART PLUS</Text>
      </View>
      <Text style={styles.title}>Save on every order</Text>
      <Text style={styles.subtitle}>Free delivery, bonus points and member-only prices, all in one plan.</Text>
      <View style={styles.perks}>
        <HeroPerk icon="bicycle" label="Free delivery" />
        <HeroPerk icon="star" label={maxPointsMultiplier > 1 ? `Up to ${maxPointsMultiplier}× points` : "Bonus points"} />
        <HeroPerk icon="pricetag" label="Member prices" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, padding: 22, overflow: "hidden", marginBottom: 20 },
  orb: { position: "absolute", borderRadius: 999 },
  orbLarge: { width: 200, height: 200, right: -70, top: -80, backgroundColor: "rgba(255,255,255,0.07)" },
  orbSmall: { width: 110, height: 110, right: 30, bottom: -60, backgroundColor: "rgba(251,191,36,0.15)" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11.5, color: colors.accentText, letterSpacing: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: "#fff", marginTop: 14, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: "rgba(255,255,255,0.85)", marginTop: 6 },
  perks: { flexDirection: "row", gap: 10, marginTop: 18 },
  perk: { flex: 1, alignItems: "center", gap: 6 },
  perkIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  perkLabel: { fontFamily: fonts.semibold, fontSize: 12, color: "#fff", textAlign: "center" },
});
