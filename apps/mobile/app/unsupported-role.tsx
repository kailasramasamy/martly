import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { colors, fonts, radius } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";

export default function UnsupportedRoleScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const t = useStrings("auth");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.icon}>
        <Ionicons name="desktop-outline" size={30} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t.unsupportedRole.title}</Text>
      <Text style={styles.message}>{t.unsupportedRole.message(user?.email)}</Text>
      <TouchableOpacity style={styles.button} onPress={logout} activeOpacity={0.85}>
        <Text style={styles.buttonText}>{t.unsupportedRole.signOut}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, alignItems: "center" },
  icon: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.text, textAlign: "center", letterSpacing: -0.3 },
  message: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary, textAlign: "center", lineHeight: 21, marginTop: 10 },
  button: {
    marginTop: "auto", alignSelf: "stretch", height: 52, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
});
