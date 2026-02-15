import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing, fontSize } from "../../constants/theme";

export default function ProfileScreen() {
  const { logout, user } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user && (
        <View style={styles.info}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.detail}>{user.email}</Text>
          <Text style={styles.detail}>{user.role}</Text>
        </View>
      )}
      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  title: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text, marginBottom: spacing.lg },
  info: { alignItems: "center", marginBottom: spacing.lg },
  name: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  detail: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  button: {
    backgroundColor: colors.error, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "600" },
});
