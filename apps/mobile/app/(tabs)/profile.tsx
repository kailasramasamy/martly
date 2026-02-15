import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing, fontSize } from "../../constants/theme";

export default function ProfileScreen() {
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  title: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text, marginBottom: spacing.lg },
  button: {
    backgroundColor: colors.error, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "600" },
});
