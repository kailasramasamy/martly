import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useRequireSignIn } from "../../lib/sign-in-context";
import { useStrings } from "../../lib/i18n/use-strings";

/** Top of the Account tab for guests: why to sign in, and the button to do it */
export function GuestAccountCard() {
  const requireSignIn = useRequireSignIn();
  const t = useStrings("account").guest;
  const perks: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "receipt-outline", text: t.perkOrders },
    { icon: "wallet-outline", text: t.perkWallet },
    { icon: "heart-outline", text: t.perkWishlist },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Ionicons name="person-outline" size={26} color={colors.primary} /></View>
      <Text style={styles.title}>{t.title}</Text>
      <View style={styles.perks}>
        {perks.map((p) => (
          <View key={p.text} style={styles.perk}>
            <Ionicons name={p.icon} size={16} color={colors.primary} />
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button"
        onPress={() => requireSignIn(() => {}, { title: t.signInTitle, subtitle: t.signInSubtitle })}>
        <Text style={styles.buttonText}>{t.signInButton}</Text>
      </Pressable>
    </View>
  );
}

/** For store owners and staff, who sign in with email on a separate screen */
export function StaffSignInLink() {
  const t = useStrings("account").guest;
  return (
    <Pressable onPress={() => router.push("/(auth)/staff-login")} style={styles.staff} accessibilityRole="link">
      <Ionicons name="storefront-outline" size={16} color={colors.textSecondary} />
      <Text style={styles.staffText}>{t.staffQuestion} <Text style={styles.staffStrong}>{t.staffAction}</Text></Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 20, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
  perks: { gap: 8 },
  perk: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  button: { marginTop: 4, backgroundColor: colors.primary, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.88 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  staff: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, marginTop: 8 },
  staffText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  staffStrong: { fontFamily: fonts.bold, color: colors.primary },
});
