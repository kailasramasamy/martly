import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { UserMembership } from "../../lib/types";

const PLUS_GRADIENT = ["#134e4a", colors.primary] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function Benefit({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

// Active membership: the Plus card plus what the member gets
export function MemberCard({ membership }: { membership: UserMembership }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(membership.endDate).getTime() - Date.now()) / DAY_MS));
  const validUntil = new Date(membership.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <LinearGradient colors={PLUS_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.orb} />
        <View style={styles.badge}>
          <Ionicons name="diamond" size={14} color={colors.accentText} />
          <Text style={styles.badgeText}>MART PLUS MEMBER</Text>
        </View>
        <Text style={styles.plan}>{membership.plan.name}</Text>
        <Text style={styles.valid}>Valid until {validUntil}</Text>
        <View style={styles.daysChip}>
          <Text style={styles.daysText}>{daysLeft} days left</Text>
        </View>
      </LinearGradient>

      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Your benefits</Text>
        {membership.plan.freeDelivery && <Benefit icon="bicycle-outline" text="Free delivery on all orders" />}
        {membership.plan.loyaltyMultiplier > 1 && (
          <Benefit icon="star-outline" text={`${membership.plan.loyaltyMultiplier}× loyalty points on every order`} />
        )}
        <Benefit icon="pricetag-outline" text="Exclusive member prices on select items" />
        <Benefit icon="flash-outline" text="Priority order processing" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 22, overflow: "hidden", marginBottom: 16 },
  orb: {
    position: "absolute", width: 180, height: 180, borderRadius: 90, right: -60, top: -60,
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11.5, color: colors.accentText, letterSpacing: 1 },
  plan: { fontFamily: fonts.extrabold, fontSize: 24, color: "#fff", marginTop: 14 },
  valid: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  daysChip: {
    alignSelf: "flex-start", marginTop: 14, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  daysText: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
  benefits: { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
  benefitsTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center",
  },
  benefitText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
});
