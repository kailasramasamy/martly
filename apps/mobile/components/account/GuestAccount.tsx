import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useRequireSignIn } from "../../lib/sign-in-context";

const PERKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "receipt-outline", text: "Track orders and reorder in a tap" },
  { icon: "wallet-outline", text: "Wallet, refunds and loyalty points" },
  { icon: "heart-outline", text: "Save favourites to your wishlist" },
];

/** Top of the Account tab for guests: why to sign in, and the button to do it */
export function GuestAccountCard() {
  const requireSignIn = useRequireSignIn();
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Ionicons name="person-outline" size={26} color={colors.primary} /></View>
      <Text style={styles.title}>You're browsing as a guest</Text>
      <View style={styles.perks}>
        {PERKS.map((p) => (
          <View key={p.text} style={styles.perk}>
            <Ionicons name={p.icon} size={16} color={colors.primary} />
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button"
        onPress={() => requireSignIn(() => {}, { title: "Sign in to Martly", subtitle: "Enter your phone number to continue" })}>
        <Text style={styles.buttonText}>Sign in with phone</Text>
      </Pressable>
    </View>
  );
}

/** For store owners and staff, who sign in with email on a separate screen */
export function StaffSignInLink() {
  return (
    <Pressable onPress={() => router.push("/(auth)/staff-login")} style={styles.staff} accessibilityRole="link">
      <Ionicons name="storefront-outline" size={16} color={colors.textSecondary} />
      <Text style={styles.staffText}>Store owner or staff? <Text style={styles.staffStrong}>Sign in here</Text></Text>
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
